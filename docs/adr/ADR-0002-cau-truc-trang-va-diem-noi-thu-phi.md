# ADR-0002: Trang nhiều route tĩnh và điểm nối cho thu phí

| Trạng thái | Ngày | Task |
|---|---|---|
| Accepted | 2026-11-19 | [T-006](../tasks/T-006_2026-11-19_trang-chinh-va-tach-gia-lap.md) |

## Context

Sản phẩm vốn là một màn hình giả lập ở `/`. Có 10 bài học nhưng chỉ mở được bằng link `?lesson=…`. Chủ dự án muốn trang chính có menu đầy đủ, giả lập ở route riêng, và một cấu trúc để sau này chia bài miễn phí / trả tiền, tính tiền, khóa tính năng.

Ràng buộc: trang đang là file tĩnh do nginx phục vụ, không có bước build, không có backend, deploy bằng cách copy một danh sách thư mục cố định lên VM.

## Decision

1. **Ba route tĩnh, mỗi route một thư mục có `index.html`:**

   | Route | Vai trò |
   |---|---|
   | `/` | Trang chính: giới thiệu, menu bài theo nhóm, lối vào giả lập |
   | `/bai-hoc/?id=<id>` | Trang bài: giải thích và giả lập nhúng trong `<iframe>` |
   | `/gia-lap/` | Giả lập, nhận `?lesson=`, `?s=`, `?match=`, `?nomenu`, `?embed=1` |

   Tài nguyên dùng đường dẫn tuyệt đối từ gốc (`/js`, `/css`, `/lessons`, `/vendor`). Link cũ `/?lesson=…` và `/?s=…` được trang chính chuyển sang `/gia-lap/`.

2. **Ba điểm nối, mỗi điểm một module trong `js/site/`:**

   | Module | Trả lời câu hỏi | Hiện tại | Khi có tài khoản / thanh toán |
   |---|---|---|---|
   | `access.js` | Bài này mở được không? Tính năng này dùng được không? | Mọi người ở gói `free`; mọi bài và tính năng đều mở | Thay `getEntitlements()` bằng lời gọi máy chủ |
   | `progress.js` | Bài nào đã đạt? | `localStorage` của trình duyệt | Thay phần lưu bằng tài khoản |
   | `catalog.js` | Có những bài nào, thứ tự ra sao, hạng gì? | Đọc `lessons/index.json` | Có thể đọc từ API |

   Trang chính, trang bài và giả lập đều đi qua ba module này; không nơi nào khác tự quyết định quyền.

3. **Hạng bài là dữ liệu:** trường `tier` (`free` / `pro`) trong `lessons/index.json`. Giá trị lạ bị coi là khóa, để lỗi gõ không vô tình mở nội dung.

4. **Khóa ở giai đoạn này chỉ là giao diện.** Trang tĩnh không giấu được file: ai biết đường dẫn `lessons/<id>.json` vẫn tải được. Khi danh mục không tải được, giả lập cho mở bài (không chặn), vì chặn ở đây không bảo vệ được gì mà chỉ làm hỏng trải nghiệm.

5. **Token thiết kế dùng chung** trong `css/tokens.css`; trang và giả lập cùng một bảng màu.

## Alternatives

| Phương án | Vì sao không chọn lúc này |
|---|---|
| Sinh trang tĩnh riêng cho từng bài (`/bai-hoc/<id>/`) | Tốt cho SEO nhưng cần bước build và đổi cách deploy. Nên làm cùng trang thuật ngữ |
| Framework (Next.js, Astro) kèm backend ngay | Đổi stack lớn khi chưa có nội dung trả tiền; phải viết lại giả lập thành component |
| Một trang, đổi màn bằng hash | Phải tải cả giả lập 3D chỉ để xem menu; không nhúng tách bạch được |
| Giả lập báo kết quả cho trang bài bằng `postMessage` | Cùng origin nên sự kiện `storage` của `localStorage` đã đủ, và tiến độ vẫn được ghi khi mở giả lập đứng riêng |

## Consequences

- Người mới vào thấy trang chính thay vì bảng điều khiển 3D; giả lập chỉ tải khi cần.
- Thêm một bài vào menu, đổi thứ tự hay đổi hạng là sửa `lessons/index.json`.
- Thêm một thư mục trang mới phải sửa ba chỗ: thư mục đó, `Dockerfile`, danh sách `source` trong workflow deploy.
- nginx phải phục vụ thư mục (`try_files $uri $uri/`) và trả chuyển hướng tương đối (`absolute_redirect off`), vì container nằm sau ánh xạ cổng 8081 → 80.
- Trang phải nằm ở gốc tên miền do dùng đường dẫn tuyệt đối.
- Trang bài dùng `?id=` nên mỗi bài chưa có URL riêng cho công cụ tìm kiếm.
- **Việc còn lại cho task thu phí:** chọn backend, xác thực, cổng thanh toán, và chuyển các bài `pro` ra khỏi thư mục tĩnh để máy chủ kiểm quyền trước khi trả. Lúc đó cần một ADR mới thay thế mục 4 ở trên.

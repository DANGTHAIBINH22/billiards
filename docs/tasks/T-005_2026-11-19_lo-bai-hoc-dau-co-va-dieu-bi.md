# T-005: Lô bài học đứng bi, trô, cule, áp phê, điều bi

| Status | Quy mô | Ngày tạo | Cập nhật | Liên quan |
|---|---|---|---|---|
| Done | M | 2026-11-19 | 2026-11-19 | T-001, T-002, T-004, [bản tổng hợp](../research/2026-11-19_tuan-monkey-tong-hop.md) |

> ID truy vết: yêu cầu `T-005.R1`, business rule `T-005.BR1`, tiêu chí `T-005.AC1`.
> Chủ dự án yêu cầu "commit và triển khai tiếp" sau T-004 và trước đó đã giao tôi chọn hướng hợp lý. Tôi chọn lô bài học này vì nó thuộc 3 ưu tiên đã nêu (áp phê, trô, cule; chạy đạn) và không cần sửa vật lý. File này ghi lại phạm vi đã chọn cùng kết quả; chưa có vòng duyệt plan riêng.

## 1. Nghiệp vụ

### 1.1 Bối cảnh & mục tiêu
- **Vấn đề:** ngoài 2 bài phá bi và 3 bài mẫu, chưa có bài nào cho các kỹ năng điều khiển bi cái.
- **Ai được lợi:** người học trô, cule, đứng bi, áp phê và điều bi.
- **Thành công khi:** có thêm 5 bài chạy được bằng `?lesson=`, mỗi bài có một "đòn bẩy" rõ ràng mà người học phải chỉnh, cú mẫu đứng vững khi lệch nhẹ.

### 1.2 Phạm vi
| In scope | Out of scope |
|---|---|
| 5 bài: `dung-bi-tranh-roi-lo`, `tro-ve`, `cule-chay-theo`, `ap-phe-bat-bang`, `quy-tac-45-do` | Bài "trô vuông góc ở nửa bi" (bi cái chạy quá xa, kết quả không ổn định) |
| Mục tiêu mới `cueRails`: bi cái phải chạm ít nhất N băng | Các bài cần mục tiêu khác: điểm chạm băng, vùng chữ nhật, chuỗi nhiều cú |
| `lessons/index.json`: danh mục bài theo nhóm | Trang hiển thị danh mục, bài nào miễn phí / trả tiền |
| Test: mục tiêu mới, danh mục khớp với file | Đổi nhãn "Đẩy / Kéo" trong bảng điều khiển sang "cule / trô" |

### 1.3 Yêu cầu / User stories
| ID | Là (actor) | Tôi muốn | Để |
|---|---|---|---|
| T-005.R1 | Người học | bài tập cho đứng bi, trô, cule, áp phê, điều bi 2 băng | luyện điều khiển bi cái từng kỹ năng một |
| T-005.R2 | Người soạn bài | đặt được mục tiêu "bi cái chạm ít nhất N băng" | bài về đường băng không bị giải bằng cách lăn thẳng tới đích |
| T-005.R3 | Người làm trang nội dung | một danh mục bài học theo nhóm, có thứ tự | dựng trang chọn bài mà không phải dò thư mục |

### 1.4 Business rules
- **T-005.BR1:** Mỗi bài chỉ đòi người học đổi một thứ (điểm chạm, hoặc lực, hoặc áp phê). Hướng cơ được đặt sẵn đúng.
- **T-005.BR2:** Cú mẫu phải còn đạt khi lệch ±0,05° hướng cơ, ±2 lực, ±0,02 điểm chạm.
- **T-005.BR3:** Scenario cũ không có `cueRails` phải cho kết quả kiểm tra y như trước.

## 2. Acceptance criteria
| ID | Yêu cầu | Given | When | Then |
|---|---|---|---|---|
| T-005.AC1 | R1 | mỗi bài trong 5 bài | đánh cú khởi đầu | "Chưa đạt", kèm đúng điều kiện bài muốn dạy |
| T-005.AC2 | R1 | mỗi bài | xem cú mẫu | mọi điều kiện đạt |
| T-005.AC3 | BR2 | mỗi bài | lệch cú mẫu ±0,05°, ±2 lực, ±0,02 điểm chạm | vẫn đạt |
| T-005.AC4 | R2 | mục tiêu `cueRails: 2` | bi cái chạm 1 băng, bi khác chạm 2 băng | không đạt, báo "mới chạm 1" |
| T-005.AC5 | R2, BR3 | scenario có `cueRails` sai kiểu; scenario cũ không có trường này | kiểm tra hợp lệ | sai kiểu bị từ chối; scenario cũ không sinh thêm trường |
| T-005.AC6 | R3 | `lessons/index.json` | đối chiếu với thư mục | liệt kê đủ 10 bài, mỗi bài một lần, tiêu đề trùng với file bài |
| T-005.AC7 | — | repo sau thay đổi | `npm test` | 0 fail |
| T-005.AC8 | R1 | trình duyệt | mở lần lượt 5 bài | không lỗi JS; thẻ kết quả đúng như AC1, AC2 |

## 3. Thiết kế

### 3.1 Impact analysis
| Khu vực | File / module | Ảnh hưởng |
|---|---|---|
| Nội dung | 5 file trong `lessons/`, `lessons/index.json` | Mới |
| Định dạng | `js/scenario.js` | `goal.cueRails`: số nguyên 1–9, tùy chọn |
| Chấm bài | `js/lesson.js` | `checkRails`: đếm sự kiện băng của bi cái |
| Test | `tests/lesson.test.js`, `tests/scenario.test.js` | Mục tiêu mới, danh mục; vòng lặp bài học bỏ qua `index.json` |

### 3.2 Giải pháp
Mỗi bài được thiết kế bằng mô phỏng: quét điểm chạm và lực quanh thế bi dự kiến, chọn tổ hợp mà bi cái dừng ở chỗ khác hẳn nhau khi đổi "đòn bẩy" của bài, đặt vùng mục tiêu quanh chỗ dừng của cú mẫu, rồi kiểm BR2.

| Bài | Đòn bẩy | Cú khởi đầu | Cú mẫu | Mục tiêu |
|---|---|---|---|---|
| `dung-bi-tranh-roi-lo` | Hạ đầu cơ | Giữa bi: bi cái rơi theo bi 1 | Kéo 40%, lực 35% | Bi 1 vào lỗ góc, bi cái không rơi lỗ |
| `tro-ve` | Hạ đầu cơ | Giữa bi: bi cái đứng gần bi 1 | Kéo 60%, lực 40% | Bi cái lùi về vùng cách bi 1 khoảng 35 cm (bán kính 18 cm) |
| `cule-chay-theo` | Nâng đầu cơ | Kéo 60%: bi cái gần như dừng | Đẩy 40%, lực 15% | Bi cái chạy tiếp tới vùng bên trái bàn (bán kính 30 cm) |
| `ap-phe-bat-bang` | Áp phê phải | Giữa bi: bật thẳng lại | Phê phải 64%, lực 14% | Chạm ít nhất 1 băng, dừng trong vùng lệch phải (bán kính 20 cm) |
| `quy-tac-45-do` | Lực | Lực 32%: thiếu 48 cm | Lực 46%, giữa bi | Bi 1 vào lỗ góc, bi cái chạm ít nhất 2 băng, dừng giữa bàn (bán kính 22 cm) |

Vùng của `cule-chay-theo` rộng vì quãng lăn tăng theo bình phương tốc độ: lệch 2 nấc lực đã dịch chỗ dừng khoảng 23 cm.

### 3.5 Edge cases & rủi ro
- **Bài áp phê có nhiều lời giải.** Hướng cơ không bị khóa, nên người học có thể bắn xiên vào băng mà không dùng áp phê và vẫn đạt. `cueRails` chỉ chặn cách lăn thẳng tới vùng.
- **Bảng điều khiển gọi "Đẩy / Kéo", đề bài gọi "cule / trô".** Đề bài có giải thích, nhưng hai cách gọi cùng xuất hiện trên một màn hình.
- **Va chạm bi–băng ở mỏ lỗ cũng tính là một lần chạm băng** trong `cueRails`.
- **Đường ngắm làm lộ đáp án** như các bài trước: mức `aim` vẽ sẵn đường đi của bi mục tiêu.

## 4. Thay đổi thực tế
| File | Thay đổi | Yêu cầu |
|---|---|---|
| `lessons/dung-bi-tranh-roi-lo.json`, `tro-ve.json`, `cule-chay-theo.json`, `ap-phe-bat-bang.json`, `quy-tac-45-do.json` (mới) | 5 bài | R1 |
| `lessons/index.json` (mới) | 5 nhóm, 10 bài | R3 |
| `js/scenario.js` | `goal.cueRails`; "Mục tiêu trống" tính cả trường này | R2 |
| `js/lesson.js` | `checkRails`, gọi trong `evaluateGoal` | R2 |
| `tests/lesson.test.js` | Test mục tiêu băng, test danh mục; bỏ qua `index.json` khi duyệt bài | R2, R3 |
| `tests/scenario.test.js` | `cueRails` hợp lệ / sai kiểu; scenario cũ không đổi | R2, BR3 |

## 5. Verification
| AC | Cách kiểm | Kết quả | Bằng chứng |
|---|---|---|---|
| T-005.AC1 | Trình duyệt + `tests/lesson.test.js` | PASS | `dung-bi-tranh-roi-lo`: ✗ Bi cái rơi lỗ. `tro-ve`: ✗ cách vùng 22 cm. `cule-chay-theo`: ✗ cách vùng 46 cm. `ap-phe-bat-bang`: ✗ cách vùng 10 cm. `quy-tac-45-do`: ✗ cách vùng 48 cm |
| T-005.AC2 | Trình duyệt + `tests/lesson.test.js` | PASS | Cả 5 cú mẫu đạt mọi điều kiện; `quy-tac-45-do` báo "Bi cái chạm 2 băng" |
| T-005.AC3 | Script thiết kế (ngoài repo) + `tests/lesson.test.js` cho ±0,05° | PASS | Cả 5 bài "robust" với ±0,05°, ±2 lực, ±0,02 điểm chạm. Riêng phần lực và điểm chạm chưa nằm trong test của repo |
| T-005.AC4 | `tests/lesson.test.js` | PASS | "ít nhất 2 băng (mới chạm 1)" |
| T-005.AC5 | `tests/scenario.test.js` | PASS | `cueRails` 0, 2.5, "2" bị từ chối; scenario cũ không có trường `cueRails` |
| T-005.AC6 | `tests/lesson.test.js` | PASS | 10 bài, tiêu đề khớp |
| T-005.AC7 | `npm test` | PASS | `# tests 98  # pass 96  # fail 0  # todo 2` |
| T-005.AC8 | Trình duyệt | PASS | 5 bài chạy đủ vòng khởi đầu, cú mẫu, thử lại; không lỗi JS |

Giới hạn: như các task trước, cửa sổ ứng dụng không mở nên tôi tự đẩy khung hình trong iframe; chưa quan sát chuyển động thật, chưa kiểm ở 375 px riêng cho lô bài này, chưa thử trên Safari, Firefox hay điện thoại.

## 6. Quyết định & câu hỏi mở
- **Đã quyết:** thêm `cueRails` vào định dạng v1 dưới dạng trường tùy chọn, không tăng số phiên bản.
- **Còn mở:**
  1. Bài nào miễn phí, bài nào trả tiền? `lessons/index.json` chưa có cờ này.
  2. Có đổi nhãn bảng điều khiển sang "Đẩy (cule)" và "Kéo (trô)" cho khớp đề bài không?

## 7. Ghi chú cho lần sau
- Bài điều khiển bi cái nên dùng lực nhẹ và tránh để bi cái chạm băng nếu không cần: mỗi lần chạm băng làm chỗ dừng nhạy hơn hẳn.
- Kiểm BR2 đầy đủ (lực, điểm chạm) hiện chỉ có trong script thiết kế. Nếu sửa vật lý, cần chạy lại hoặc đưa hẳn vào test.
- Còn lại trong danh mục đề xuất mà làm được ngay: B2, B6, B7, B8, C2, C4, C5, C9, D1, D2, D5, D6, D8.

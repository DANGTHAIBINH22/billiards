# ADR-0001: Va chạm bi–bi bằng mô phỏng tiếp xúc thay cho xung lực

| Trạng thái | Ngày | Task |
|---|---|---|
| Accepted | 2026-11-19 | [T-002](../tasks/T-002_2026-11-19_va-cham-va-cu-pha.md) |

## Context

Engine xử lý va chạm bi–bi bằng xung lực từng cặp, phát hiện khi hai bi đã chồng lên nhau sau một bước thời gian cố định (1/480 s). Hai hệ quả đo được:

- Hướng bi mục tiêu phụ thuộc vị trí bi cái trong bước tính. Cú nửa bi ở 7 m/s cho hướng dao động 7,6°.
- Khuôn bi là một tiếp xúc nhiều vật. Giải từng cặp theo thứ tự cho kết quả tùy thứ tự: bi cái không bật lại khi phá thẳng, bi trong khuôn tỏa sai hướng.

## Decision

1. **Tìm thời điểm chạm.** Mỗi bước được cắt tại lúc hai bi trên mặt bàn vừa chạm nhau (giải phương trình bậc hai với vận tốc coi là hằng trong bước), nên va chạm luôn được xử lý ở đúng vị trí tiếp xúc.
2. **Mô phỏng tiếp xúc cho cả cụm bi đang chạm** (`js/contact.js`), bước 2 micro giây:
   - Lực pháp tuyến Hertz $F_n = k\,\delta^{3/2}$, nhân $e^2$ khi hai bi đang tách ra. Cách này cho hệ số nảy $e$ không đổi theo tốc độ.
   - Ma sát Coulomb $F_t = \mu(v)\,F_n$ theo vectơ trượt tại điểm chạm (cả phương ngang lẫn phương đứng), $\mu(v) = a + b\,e^{-cv}$ theo số đo của Alciatore.
   - Throw, truyền phê và độ hao xoáy dọc khi va chạm đều sinh ra từ lực ma sát này, không còn công thức riêng.
3. **Cửa sổ tiếp xúc coi là tức thời** đối với thời gian của bàn. Bi trong cụm kết thúc cửa sổ ở vị trí lệch tối đa vài milimét so với nếu tính đủ thời gian.
4. Bi đang bay (gậy nhảy) vẫn dùng xung lực cũ.

## Alternatives

| Phương án | Vì sao không chọn |
|---|---|
| Giảm bước cố định xuống 1/4800 s | Chậm gấp 10; vẫn không có bi cái bật lại |
| Tìm thời điểm chạm, giữ xung lực, giải lặp cho cụm bi | Kết quả cụm bi phụ thuộc thứ tự giải; ở giới hạn bước mịn bi cái chỉ bật lại 7% |
| Giảm chấn kiểu Hunt–Crossley cho lực pháp tuyến (ý định ban đầu trong plan) | Hệ số nảy thay đổi theo tốc độ (0,98 ở 1 m/s, dưới 0,90 ở 8 m/s) |

## Consequences

- Hướng bi sau va chạm không còn phụ thuộc bước tính: chênh dưới 0,02° giữa bước 1/480 s và 1/4800 s.
- Phá thẳng vào khuôn khít, bi cái bật lại khoảng 15% tốc độ tới.
- Góc lăn tự nhiên khớp lý thuyết hơn (nửa bi 33,9°, trước là 30,8°).
- Va chạm làm hao xoáy dọc của bi cái nhiều hơn trước. Cú đứng bi "dễ" hơn: bài mẫu `dung-bi` phải soạn lại.
- Hiệu năng không đổi đáng kể: dự đoán cú cắt 1,5 ms, cú phá 15 bi 13 ms trên máy phát triển.
- Thêm tham số trong `PARAMS`: `kHertz`, `contactDt`, `contactMax`, `muBallA/B/C`, `muBallScale`. Bỏ `muBall`.
- Kết quả giữa các trình duyệt có thể lệch ở chữ số cuối, vì một cửa sổ tiếp xúc cộng dồn hàng trăm bước nhỏ.

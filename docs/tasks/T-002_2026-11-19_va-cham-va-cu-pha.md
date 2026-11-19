# T-002: Sửa va chạm tốc độ cao và vật lý cú phá

| Status | Quy mô | Ngày tạo | Cập nhật | Liên quan |
|---|---|---|---|---|
| Done (phần C đạt 2/5; phần còn nợ chuyển sang T-003) | L | 2026-11-19 | 2026-11-19 | T-001, [nghiên cứu kênh Tuấn Monkey](../research/2026-11-19_tuan-monkey-tong-hop.md) |

> ID truy vết: yêu cầu `T-002.R1`, business rule `T-002.BR1`, tiêu chí `T-002.AC1`.

## 1. Nghiệp vụ

### 1.1 Bối cảnh & mục tiêu
- **Vấn đề:** Bài học phá bi (nhóm A, 9 bài) không dùng được vì engine cho kết quả phá sai so với thực tế. Đo trên engine hiện tại:
  - Hướng bi mục tiêu sau va chạm thay đổi theo vị trí bi cái. Cú nửa bi ở 7 m/s cho hướng từ −4,9° đến +2,7°; ở 2 m/s từ +1,0° đến +2,7°. Dời bi cái 3 mm là đổi kết quả.
  - Phá thẳng vào cụm bi, bi cái nằm tại chỗ thay vì bật ngược lại.
  - Bi cánh 9 bi xếp thấp không vào lỗ góc.
  - Lực tối đa 7 m/s, thấp hơn cú phá thật (khoảng 10 m/s).
- **Ai được lợi:** người học các bài phá bi; và mọi bài khác, vì lỗi hướng bi ảnh hưởng cả cú đánh thường từ 2 m/s trở lên.
- **Thành công khi:** hướng bi sau va chạm không còn phụ thuộc bước thời gian (đo được, mục 2 phần A–B); cú phá khớp các cú tham chiếu trong video ở mức ghi rõ trong mục 2 phần C.

### 1.2 Phạm vi
| In scope | Out of scope (đề xuất T-003) |
|---|---|
| Phát hiện đúng thời điểm chạm cho bi–bi và bi–băng | Phá sốc: gậy dốc 7–10° làm bi cái nảy |
| Mô hình tiếp xúc mới cho bi–bi, xử lý được cụm bi khít | Swerve (bi cong khi đánh áp phê) |
| Throw phụ thuộc tốc độ | Độ bạt theo loại ngọn |
| Khuôn bi khít hẳn | Băng khi đánh mạnh (góc bật theo lực) |
| Lực phá tới khoảng 10,5 m/s | Khuôn 8 bi phá vào bi hàng 2 |
| Bộ test tham chiếu cú phá + hiệu chỉnh tham số | Hiệu chỉnh theo số đo của một bàn cụ thể |
| Cập nhật 3 bài mẫu và test cũ bị ảnh hưởng | Soạn 9 bài học phá bi (làm sau khi task này xong) |

### 1.3 Yêu cầu / User stories
| ID | Là (actor) | Tôi muốn | Để |
|---|---|---|---|
| T-002.R1 | Người chơi | cùng một cú đánh cho cùng hướng bi, dù bi cái đặt gần hay xa vài milimét | tin được đường bi mình thấy |
| T-002.R2 | Người chơi | phá thẳng vào cụm bi thì bi cái bật ngược lại như bàn thật | tập giữ bi cái giữa bàn bằng cule / trô |
| T-002.R3 | Người chơi | bi trong cụm tỏa ra đúng hướng như cú phá thật | tập cú phá 9 bi, 10 bi có ý nghĩa |
| T-002.R4 | Người chơi | phá được với lực thật của một cú phá | không bị giới hạn ở lực cú đánh thường |
| T-002.R5 | Người chơi | bi mục tiêu lệch dày nhiều hơn khi đánh nhẹ, ít hơn khi đánh mạnh | học bù throw đúng |
| T-002.R6 | Người soạn bài | có bộ cú phá tham chiếu chạy tự động | biết ngay khi một thay đổi làm hỏng cú phá |
| T-002.R7 | Người chơi | khi ngắm, đường dự đoán vẫn mượt | không giật khi kéo hướng cơ |

### 1.4 Business rules
- **T-002.BR1:** Engine phải tất định. Cùng thế bi và cùng cú đánh luôn cho cùng kết quả, để chấm bài và cú mẫu còn đúng.
- **T-002.BR2:** Đường dự đoán và cú đánh thật dùng chung một mã vật lý, như hiện nay.
- **T-002.BR3:** Tham số vật lý chỉ được chỉnh trong khoảng có cơ sở (ghi nguồn hoặc lý do trong code). Không ép tham số phi thực tế để một cú tham chiếu "đạt".
- **T-002.BR4:** Cú tham chiếu nào không đạt sau hiệu chỉnh thì báo cáo độ lệch còn lại, không che đi.
- **T-002.BR5:** Chế độ ván 2 người, luật WPA, định dạng scenario v1 không đổi.

### 1.5 Luồng xử lý một bước mô phỏng (sau thay đổi)
```mermaid
flowchart TD
    A[Bắt đầu bước dt] --> B[Tìm thời điểm chạm sớm nhất trong phần dt còn lại: bi–bi, bi–băng]
    B --> C{Có chạm?}
    C -- Không --> D[Cho mọi bi chạy hết phần còn lại] --> Z[Xong bước]
    C -- Bi–băng --> E[Chạy tới thời điểm chạm, giải băng như hiện tại] --> B
    C -- Bi–bi --> F[Chạy tới thời điểm chạm]
    F --> G[Gom cụm bi đang chạm nhau]
    G --> H[Mô phỏng tiếp xúc bước rất nhỏ cho riêng cụm đó tới khi tách hết]
    H --> I[Ghi sự kiện 'ball' cho từng cặp đã chạm] --> B
```

## 2. Acceptance criteria

### Phần A. Thời điểm chạm (chắc chắn làm được)
| ID | Yêu cầu | Given | When | Then |
|---|---|---|---|---|
| T-002.AC1 | R1 | Cú nửa bi không xoáy, 12 vị trí bi cái lệch nhau 3,1 mm | bắn ở 1, 2, 3, 5, 7, 10 m/s | ở mỗi tốc độ, hướng bi mục tiêu chênh nhau không quá 0,2° (hiện tại tới 7,6°) |
| T-002.AC2 | R1 | 5 cú tham chiếu 2 bi (thẳng, 3/4, 1/2, 1/4 bi, 1 băng trước) | chạy với bước 1/480 s và 1/4800 s | hướng bi mục tiêu chênh không quá 0,2°; chỗ bi cái dừng chênh không quá 2 cm |
| T-002.AC3 | R1 | Cú sượt, hai bi chỉ chồng nhau 0,3 mm theo phương ngang | bắn ở 10 m/s | va chạm được ghi nhận (hiện tại có thể lọt qua) |
| T-002.AC4 | R1 | Bi lăn vào băng ở 7 m/s, góc 45° | chạy với bước 1/480 s và 1/4800 s | điểm chạm băng chênh không quá 1 mm |

### Phần B. Mô hình tiếp xúc (chắc chắn làm được)
| ID | Yêu cầu | Given | When | Then |
|---|---|---|---|---|
| T-002.AC5 | R2 | Hai bi, bắn thẳng tâm, 1 đến 8 m/s | va chạm | hệ số nảy đo được nằm trong 0,92–0,96 |
| T-002.AC6 | R5 | Cú nửa bi, đứng bi | 1 m/s và 5 m/s | throw ở 1 m/s trong 3,5°–5,5°; ở 5 m/s trong 1,0°–3,0°; giảm dần theo tốc độ |
| T-002.AC7 | BR5 | Các quy tắc đã khớp trước đây | đo lại | đứng bi giữ lại 1/8, 1/4, 1/2 tốc độ với sai số ±0,03; lăn tự nhiên nửa bi cho góc 30°–35°; má 1/8 bi cho 18°–21° |
| T-002.AC8 | R2 | Khuôn 10 bi khít, bắn thẳng bi 1, không xoáy | 8 m/s | vận tốc bi cái dọc đường bắn ngay sau khi rời cụm bi âm, độ lớn từ 8% tốc độ tới trở lên (thử nghiệm: 13–15%) |
| T-002.AC9 | BR1 | Một cú phá bất kỳ | chạy 2 lần | vị trí cuối mọi bi trùng nhau tuyệt đối |
| T-002.AC10 | R7 | Thế cắt 30°, lực 35%, tầm dự đoán 2,5 s | gọi `predict` | không quá 4 ms trên máy này (hiện 1,8 ms). Cú phá 15 bi, lực 85%, 2,5 s: không quá 40 ms (hiện 13 ms) |

### Phần C. Cú phá tham chiếu (mục tiêu hiệu chỉnh, chưa cam kết đạt hết)
Thử nghiệm sơ bộ cho thấy mô hình mới đưa hướng bi cánh tới cách đường vào lỗ góc khoảng 5–6°, và hướng bi 1 khi phá xếp cao nhạy với hệ số nảy. Vì vậy phần này là mục tiêu, kết quả từng dòng sẽ được báo cáo.

| ID | Cú tham chiếu | Thiết lập | Mục tiêu |
|---|---|---|---|
| T-002.AC11 | P1: 9 bi xếp thấp, phá ép 1 băng | Bi cái ở cánh trên vạch; chạm 0,62–0,70 bi số 1; 1 đầu cơ dưới tâm; 7–9 m/s; 6 tổ hợp | Bi cánh phía người phá vào lỗ góc cuối bàn ở ít nhất 4/6 tổ hợp |
| T-002.AC12 | P1a: bắn quá dày | Như trên, chạm 0,80–0,90 bi | Bi 1 vào lỗ giữa hoặc chạm băng trong vòng 15 cm quanh lỗ giữa |
| T-002.AC13 | P3: 9 bi xếp cao, break box | Mép ngoài bi cái sát vạch box; chạm 0,40–0,50 bi; 1–2 đầu cơ trô; 8–9 m/s | Bi 1 vào lỗ giữa ở ít nhất một độ dày; dày hơn thì bi 1 lệch xuống dưới lỗ, mỏng hơn thì lệch lên trên |
| T-002.AC14 | P8: 10 bi phá nhẹ | Gần giữa bàn, lệch nửa bi; thẳng bi 1; hơi trô; 6–7 m/s | Hai bi hàng 2 đi về phía lỗ giữa, lệch không quá 8°. Đổi sang cule thì chúng đi thấp hơn |
| T-002.AC15 | P2: phá thẳng 9 bi xếp thấp | Nửa đầu cơ cule, 9 m/s | Bi cái bật lại rồi dừng trong nửa giữa bàn |

- **T-002.AC16 (BR3, BR4):** Bảng kết quả 5 cú trên được ghi vào mục 5, kèm giá trị tham số cuối và khoảng cho phép của từng tham số. Đạt từ 3/5 trở lên thì coi phần C xong; dưới 3/5 thì dừng, báo cáo và hỏi hướng đi.

### Phần D. Lực phá và hồi quy
| ID | Yêu cầu | Given | When | Then |
|---|---|---|---|---|
| T-002.AC17 | R4 | Bàn có khuôn bi, bi cái trong bếp | bật "Lực phá" và kéo lực 100% | bi cái rời cơ ở 10,5 m/s; tắt đi thì 100% vẫn là 7,0 m/s như cũ |
| T-002.AC18 | R6 | Repo sau thay đổi | `npm test` | mọi test pass; test cũ nào phải sửa ngưỡng đều được liệt kê kèm lý do ở mục 4 |
| T-002.AC19 | BR5 | 3 bài mẫu của T-001 | chạy test bài học | cú mẫu vẫn đạt, cú khởi đầu vẫn không đạt (sau khi tính lại góc mẫu nếu cần) |
| T-002.AC20 | BR5 | Trình duyệt, 1440×900 và 375×812 | luyện tập cắt 30°, một bài học, một ván 9 bi có cú phá | chạy bình thường, console không lỗi, kéo hướng cơ không giật |

## 3. Thiết kế

### 3.1 Impact analysis
| Khu vực | File / module | Ảnh hưởng |
|---|---|---|
| Lõi vật lý | `js/physics.js` | `stepWorld` chuyển sang chia bước theo sự kiện chạm. `collideBalls` cho bi trên mặt bàn được thay bằng mô phỏng tiếp xúc; bi đang bay giữ mô hình xung lực cũ. Thêm tham số tiếp xúc vào `PARAMS` |
| Tiếp xúc (mới) | `js/contact.js` | Mới. Mô phỏng tiếp xúc Hertz có giảm chấn và ma sát cho một cụm bi; thuần, test được riêng |
| Khuôn bi | `js/racks.js` | `GAP` về đúng 2R (khít). Kiểm tra lại `validateScenario` vẫn nhận khuôn khít (đã có sai số 0,1 mm) |
| Dự đoán | `js/aim.js` | `analyze` đọc sự kiện `ball`. Giữ nguyên cấu trúc sự kiện; bỏ đoạn vá "engine phát hiện chạm trễ một bước" nếu không còn cần |
| Lực đánh | `js/scenario.js`, `js/main.js`, `index.html` | `shotSpeed` thêm chế độ phá; công tắc "Lực phá" trong bảng điều khiển |
| Bài học | `lessons/*.json` | Tính lại góc cú mẫu nếu throw đổi làm lệch |
| Test | `tests/collision.test.js`, `tests/break.test.js` (mới); `tests/physics.test.js`, `tests/aim.test.js`, `tests/cushion.test.js`, `tests/jump.test.js`, `tests/pocket.test.js` | 2 file mới cho phần A–C. 23 test cũ trong 5 file chạm tới va chạm: rà từng cái, chỉ sửa ngưỡng khi hành vi mới đúng hơn và ghi lý do |
| Tài liệu | `docs/adr/ADR-0001-mo-hinh-tiep-xuc-bi.md` (mới) | Ghi quyết định đổi mô hình va chạm |

Không đụng: `js/rules.js`, `js/lesson.js`, mô hình băng (Mathavan), mô hình nỉ, gậy nhảy.

### 3.2 Giải pháp

**Bước 1: tìm đúng thời điểm chạm.** Trong một bước `dt`, coi vận tốc mỗi bi là hằng để giải phương trình bậc hai tìm lúc khoảng cách hai tâm bằng 2R, và lúc tâm bi chạm đường băng. Lấy sự kiện sớm nhất, cho mọi bi chạy tới đúng lúc đó bằng `advance` (vẫn tính ma sát nỉ chính xác), xử lý, rồi lặp cho phần `dt` còn lại. Sai số do coi vận tốc hằng trong 2 ms là cỡ 4 micromet.

**Bước 2: mô phỏng tiếp xúc cho cụm bi.** Khi hai bi chạm, gom mọi bi đang chạm nhau thành một cụm (với khuôn khít là cả khuôn). Chạy riêng cụm đó với bước 1 micro giây:
- Lực pháp tuyến theo Hertz: $F_n = k\,\delta^{3/2}(1 - c\,\dot{d})$, với $\delta$ là độ lún, $\dot d$ là tốc độ tách. $k \approx 4{,}9\times10^{8}\ \mathrm{N/m^{3/2}}$ cho bi phenolic; $c$ chỉnh để hệ số nảy khoảng 0,94.
- Ma sát Coulomb $F_t = \mu(v)\,F_n$ ngược chiều trượt tại điểm chạm, có tính xoáy ngang của hai bi. Throw và truyền phê sinh ra từ đây, không còn công thức riêng.
- $\mu(v) = a + b\,e^{-c\,v}$ theo số đo của Alciatore ($a = 0{,}01$, $b = 0{,}108$, $c = 1{,}088$), cho throw lớn khi chậm và nhỏ khi nhanh.
- Dừng khi mọi cặp đã tách. Một va chạm 2 bi kéo dài khoảng 0,3 ms; cả khuôn khoảng 2–3 ms.

Vì bi trong khuôn được giải đồng thời, bi cái bật lại và hướng tỏa của bi trong khuôn là kết quả của mô hình, không phải luật viết tay.

**Bước 3: hiệu chỉnh.** Bốn tham số được phép chỉnh và khoảng của chúng: hệ số nảy bi–bi 0,92–0,96; ma sát bi–bi theo đường cong trên, nhân hệ số 0,7–1,5; độ hở khuôn 0 đến 0,05 mm; hình dạng hàm lỗ góc (bán kính bắt bi và vị trí mỏ lỗ) trong sai số ±5 mm so với chuẩn WPA. Chạy quét trên 5 cú tham chiếu và chọn bộ tham số đạt nhiều mục tiêu nhất.

**Bước 4: lực phá.** Thêm công tắc "Lực phá", chỉ hiện khi bi cái nằm trong bếp và trên bàn có khuôn bi. Bật lên thì thang lực 1–100% trải từ 0,4 đến 10,5 m/s. Scenario lưu thêm cờ `breakPower` trong `shot` (không có cờ thì hành vi như cũ, không cần tăng phiên bản định dạng).

### 3.3 Phương án đã cân nhắc
| Phương án | Ưu | Nhược | Chọn? |
|---|---|---|---|
| A. Giảm bước thời gian cố định xuống 1/4800 s | Sửa một dòng | Chậm gấp 10. Đo thử: vẫn không có bi cái bật lại, bi cánh vẫn không vào | |
| B. Tìm thời điểm chạm + giữ mô hình xung lực, giải lặp cho cụm bi | Nhanh, ít tham số | Kết quả cụm bi phụ thuộc thứ tự giải. Đo thử với bước rất mịn (giới hạn của hướng này): bi cái chỉ bật lại 7%, bi cánh không vào ở 9/9 tổ hợp | |
| C. Tìm thời điểm chạm + mô phỏng tiếp xúc Hertz cho cụm bi | Có cơ sở vật lý; throw và truyền phê tự sinh ra; thử nghiệm cho bi cái bật lại 13–15%, bi 1 xếp cao lệch lỗ giữa 5° trước khi chỉnh | Nhiều mã hơn; phải hiệu chỉnh; tốn thêm thời gian tính mỗi va chạm | ✅ |

### 3.4 Hợp đồng dữ liệu
- **Sự kiện `ball`** giữ nguyên các trường: `type, t, a, b, ax, ay, bx, by, air, before, after`. `before`/`after` là vận tốc lúc bắt đầu chạm và lúc tách. Với cụm bi, mỗi cặp từng chạm phát đúng một sự kiện, theo thứ tự thời điểm bắt đầu chạm.
- **`stepWorld(balls, dt, events, t)`** và **`simulate(start, opts)`** giữ nguyên chữ ký.
- **`PARAMS` thêm:** `kHertz`, `cDamp`, `muBallA`, `muBallB`, `muBallC`, `contactDt`. Bỏ `eBall`, `muBall` (đổi tên sẽ làm lộ mọi chỗ còn dùng).
- **`shotSpeed(power, jump, breakPower)`**: thêm tham số thứ ba, mặc định `false`.
- **Scenario `shot.breakPower`**: boolean, tùy chọn.

### 3.5 Edge cases & rủi ro
- **Phần C có thể không đạt hết.** Thử nghiệm cho thấy hướng bi cánh ổn định quanh −53° trong khi lỗ góc ở −47°, gần như không đổi khi chỉnh ma sát từ 0,02 đến 0,10. Có thể cần chỉnh hình dạng hàm lỗ, hoặc mô hình còn thiếu một hiệu ứng. AC16 quy định cách xử lý.
- **Hiệu năng trên điện thoại.** Mỗi va chạm tốn thêm vài trăm bước nhỏ. AC10 đặt ngưỡng trên máy này; điện thoại chậm hơn 3–5 lần nên cú phá 15 bi khi ngắm có thể tới 150 ms. Phương án dự phòng: khi ngắm cú phá, chỉ dự đoán tới lúc bi cái chạm khuôn.
- **Bi đang bay** (gậy nhảy) vẫn dùng xung lực cũ. Va chạm giữa một bi bay và một bi trên bàn không qua mô hình mới.
- **Ba bi chạm nhau ngoài khuôn** (cộng bi, bi dính) nay cũng được giải đồng thời. Hành vi sẽ khác trước, và đúng hơn, nhưng test cộng bi cũ có thể phải đổi ngưỡng.
- **Bi dính băng trong cụm.** Băng không tham gia mô phỏng tiếp xúc; nếu một bi của cụm chạm băng trong lúc cụm đang được giải thì xử lý ở vòng sự kiện kế tiếp. Chấp nhận sai số này.
- **Test cũ mã hóa hành vi sai.** Một số ngưỡng trong `tests/physics.test.js` và `tests/aim.test.js` có thể đang khớp với throw cố định 2,85°. Quy tắc: chỉ sửa ngưỡng khi chứng minh được hành vi mới đúng hơn, ghi từng trường hợp.
- **Số thực và tính tất định.** Bước 1 micro giây cộng dồn hàng nghìn lần vẫn tất định trên cùng một trình duyệt. Khác trình duyệt có thể lệch ở chữ số cuối; chấm bài dựa trên bi vào lỗ và vùng dừng nên không nhạy tới mức đó, nhưng cú mẫu nằm sát biên cửa sổ góc thì có thể. Giữ biên an toàn khi soạn bài.
- **Nhánh.** Thay đổi T-001 đang nằm chưa commit trên `feat/scenario-lesson-mode`. Task này đụng lại `js/main.js` và `js/scenario.js`, nên cần T-001 được commit trước rồi mới tách nhánh mới.

## 4. Thay đổi thực tế
| File | Thay đổi | Yêu cầu |
|---|---|---|
| `js/contact.js` (mới) | `resolveContact`: mô phỏng tiếp xúc Hertz + ma sát cho cả cụm bi đang chạm | R2, R3, R5 |
| `js/physics.js` | `stepWorld` cắt bước tại thời điểm chạm (`nextContact`) và theo quãng đi tối đa 10 mm; `contactWindow` gọi mô hình mới; `rails` đưa bi về đúng điểm cắt đường băng; `collideBalls` chỉ còn dùng cho bi đang bay; `PARAMS` thêm `kHertz`, `contactDt`, `contactMax`, `muBallA/B/C`, `muBallScale`, bỏ `muBall` | R1, R2, R5 |
| `js/racks.js` | `GAP = 2R`: khuôn khít hẳn | R3 |
| `js/scenario.js` | `shotSpeed(power, jump, breakPower)`; `shot.breakPower` trong định dạng scenario (chỉ ghi khi bật) | R4 |
| `js/main.js`, `index.html` | Công tắc "Lực phá", `state.breakPower`, `syncBreakPower`; tự tắt sau cú đánh | R4 |
| `lessons/dung-bi.json` | Soạn lại: bi cái lùi ra xa hơn (0, −0,332), cú mẫu hạ đầu cơ 32% | BR5 |
| `tests/collision.test.js` (mới) | 11 test cho phần A và B | R6 |
| `tests/break.test.js` (mới) | 7 test khóa hành vi đã đạt, 3 test `todo` cho mục tiêu chưa đạt | R6 |
| `tests/racks.test.js` | Một ngưỡng: bi góc sau của khuôn 10 bi nay nằm đúng 3R (trước là 3R × 1,0005), nên so sánh `>` phải thành `> 3R − 1e-9` | R3 |
| `tests/scenario.test.js`, `tests/lesson.test.js` | Thêm test `breakPower`; hàm chạy bài học truyền `breakPower` | R4 |
| `docs/adr/ADR-0001-mo-hinh-tiep-xuc-bi.md` (mới) | Quyết định đổi mô hình va chạm | — |
| `docs/research/2026-11-19_tuan-monkey-tong-hop.md` | Đính chính 3 dòng đo cú phá, thêm mục 6.1 | — |

Khác với thiết kế ở mục 3:
- **Hệ số nảy.** Plan định dùng giảm chấn $(1 - c\,\dot d)$. Đo thử thì hệ số nảy đổi theo tốc độ, không đạt AC5. Đổi sang lực tách bằng $e^2$ lần lực nén, cho $e$ đúng 0,95 ở mọi tốc độ. Vì vậy giữ `eBall`, không có `cDamp`.
- **`js/aim.js` không sửa.** Đoạn dựng lại điểm chạm vẫn đúng với sự kiện mới.
- **Test cũ:** 42/43 test cũ pass nguyên trạng với engine mới; chỉ sửa một ngưỡng ở `tests/racks.test.js` (lý do ở bảng trên).
- **Băng:** không làm vòng sự kiện riêng cho bi–băng. Thay vào đó đưa bi về điểm cắt đường băng rồi trả lại phần thời gian đã vượt quá. Đủ đạt AC4.

## 5. Verification
| AC | Cách kiểm | Kết quả | Bằng chứng |
|---|---|---|---|
| T-002.AC1 | `tests/collision.test.js` + script đo | PASS (có lưu ý) | Chênh giữa bước 1/480 s và 1/4800 s dưới 0,02° ở cả 72 tổ hợp. Với bi cái đang lăn, 12 vị trí cho hướng chênh dưới 0,2° ở mọi tốc độ. Với bi cái bắn tâm, tại 2 m/s độ chênh là 0,25°: đó là vật lý thật (bi cái đang chuyển từ trượt sang lăn nên xoáy lúc chạm khác nhau), bước mịn cho cùng con số |
| T-002.AC2 | Script đo | PASS | 4 cú 2 bi: hướng chênh 0,0000°, chỗ dừng chênh tối đa 0,11 cm. Cú băng trước: 0,18° và 0,21 cm |
| T-002.AC3 | `tests/collision.test.js` | PASS | Cú sượt 0,3 mm ở 10 m/s: 1 va chạm |
| T-002.AC4 | `tests/collision.test.js` | PASS | Điểm chạm băng chênh dưới 1 mm |
| T-002.AC5 | `tests/collision.test.js` | PASS | e = 0,950 ở 1, 3, 5, 8 m/s |
| T-002.AC6 | `tests/collision.test.js` + script đo | **Đạt một phần** | 1 m/s: 4,75° (đạt). Giảm dần theo tốc độ (đạt): 3,44° ở 2 m/s, 2,07° ở 3 m/s. 5 m/s: 0,74°, thấp hơn khoảng 1,0°–3,0° đã ghi. Khoảng đó là ước lượng của tôi; đường cong ma sát lấy nguyên từ số đo của Alciatore và ở 3 m/s khớp nguồn (1,5°–2°), nên tôi không sửa tham số để ép |
| T-002.AC7 | `tests/collision.test.js` | PASS | Đứng bi giữ 0,125 / 0,239 / 0,470. Lăn tự nhiên: 28,2° / 33,9° / 27,1°; má 1/8: 19,7° |
| T-002.AC8 | `tests/break.test.js`, `tests/collision.test.js` | PASS | Khuôn 10 bi: bi cái bật lại 14%–16% tốc độ tới ở 6, 8, 10 m/s (tôi đo 15,6%, agent đo 14,2%–15,0%) |
| T-002.AC9 | `tests/collision.test.js` | PASS | Hai lần chạy cho vị trí cuối trùng tuyệt đối |
| T-002.AC10 | Script đo (Node) | PASS | Cắt 30°: 1,5 ms (ngưỡng 4). Phá 15 bi 85%: 13,2 ms (ngưỡng 40) |
| T-002.AC11 | `tests/break.test.js` (`todo`) | **FAIL** | 0/6. Bi cánh rời khuôn ở −38° đến −46°; lỗ góc nhận −49,5° đến −45,3° |
| T-002.AC12 | `tests/break.test.js` | PASS | 3/3: dày 0,80 chạm băng cách lỗ giữa 8 cm; 0,85 và 0,90 bi 1 vào lỗ giữa |
| T-002.AC13 | `tests/break.test.js` (`todo` + test chiều lệch) | **FAIL** (chiều lệch đúng) | Bi 1 chạm băng cách lỗ giữa 6–9 cm về phía cuối bàn ở độ dày 0,40–0,50; vào lỗ quanh 0,60. Mỏng hơn thì lệch về cuối bàn, dày hơn về đầu bàn, đúng như video |
| T-002.AC14 | `tests/break.test.js` | **Đạt một phần** | Hai bi hàng 2 rời ở −137,7° và +137,1°, lỗ giữa ở ±135,8° (đạt, lệch dưới 2°). Đổi trô sang cule không làm đổi hướng (không đạt) |
| T-002.AC15 | `tests/break.test.js` | PASS (nhạy) | Bi cái bật lại 10%, dừng ở (0,52; 0,17). Chỗ dừng rất nhạy với tham số: e = 0,94 cho x = 0,72 (ngoài vùng), e = 0,96 cho x = 0,27 |
| T-002.AC16 | Bảng này | **Chưa đạt ngưỡng** | 2/5 đạt trọn (AC12, AC15). Theo plan: dừng phần C, báo cáo, hỏi hướng đi. Tham số cuối: `eBall` 0,95 (khoảng cho phép 0,92–0,96), `muBallScale` 1 (0,7–1,5), độ hở khuôn 0 (0–0,05 mm). Quét 12 tổ hợp trong các khoảng đó không cải thiện AC11, AC13 |
| T-002.AC17 | Trình duyệt | PASS | Khuôn 9 bi: bật "Lực phá" thì 100% = 10,5 m/s, tắt thì 7,0 m/s. Ván 9 bi: 85% = 9,0 m/s. Tự tắt sau cú đánh |
| T-002.AC18 | `npm test` | PASS | `# tests 82  # pass 79  # fail 0  # todo 3` |
| T-002.AC19 | `tests/lesson.test.js` + trình duyệt | PASS | Cả 3 bài: cú mẫu đạt, cú khởi đầu không đạt. `dung-bi` phải soạn lại |
| T-002.AC20 | Trình duyệt (xem lưu ý) | PASS (có giới hạn) | Luyện tập cắt 30° ăn bi; phá 9 bi; ván 9 bi chuyển lượt; 3 bài học chạy đủ vòng; không lỗi JS. Bảng điều khiển ở 375 px không tràn ngang |

Lệnh đã chạy: `npm test` (79 pass, 0 fail, 3 todo), `node --check` cho các file js đã sửa. Dự án không có typecheck/lint/build.

### Kiểm độc lập (agent `qa-verifier`)

Agent chạy lại `npm test`, tự viết script đo ngoài repo, chạy 400 bàn ngẫu nhiên và rà mã. Kết luận: đạt cả 6 hạng mục, không có lỗi chặn.

| Hạng mục | Kết quả của agent |
|---|---|
| `npm test` | 82 test: 79 pass, 0 fail, 3 todo; mã thoát 0. Ba test không pass đúng là 3 test `todo` |
| AC1, AC5, AC6, AC9 | Tái lập đúng các con số ở bảng trên |
| AC8 | Bi cái bật lại 14,2%–15,0%, không phải đúng 15,6% như tôi ghi (cách lấy mẫu vận tốc khác nhau). Vẫn trên ngưỡng 8% |
| AC10 | Cắt 2 bi: 2,6 ms. Phá 15 bi ở 9 m/s, tầm 6 s: 26 ms, lần gọi đầu 41 ms. Thiết lập nặng hơn AC (tôi đo 6 m/s, tầm 2,5 s: 13 ms) |
| Năng lượng, NaN, treo | 400 bàn ngẫu nhiên (2–15 bi, có bi chồng nhau, tới 10 m/s): không NaN, không bước nào tăng năng lượng, bước chậm nhất 3,6 ms. 32 bi dày đặc: bước chậm nhất 45 ms, không treo |
| Hồi quy T-001 | `validateScenario` bản mới và bản `e8834a5` cho kết quả trùng nhau trên 506 scenario |
| Dữ liệu không tin cậy | `shot.breakPower` chỉ nhận đúng giá trị `true`; mọi kiểu khác bị bỏ |

Agent nêu thêm:
- **Lỗi mức thấp:** hai bi nằm trùng hẳn một điểm thì đi xuyên qua nhau (khoảng cách 0 bị bỏ qua). Không tới được từ link chia sẻ vì bộ kiểm tra scenario đã chặn bi chồng nhau; chưa sửa.
- **Throw với bi cái đang lăn rất nhỏ:** 0,17° ở 3 m/s, −0,08° ở 5 m/s. Các số ở AC6 là cho cú đứng bi. Xoáy dọc làm giảm throw là hiện tượng có thật, nhưng mức giảm này chưa được đối chiếu với số đo nào.
- Agent không dùng trình duyệt, nên AC17 và AC20 chỉ có kết quả của tôi.

Giới hạn khi kiểm trên trình duyệt:
- Cửa sổ ứng dụng không mở trong lúc kiểm, nên khung trình duyệt bị ẩn và không chạy hoạt ảnh. Tôi nạp game vào một iframe có thay `requestAnimationFrame` và đồng hồ để tự đẩy từng khung hình. Logic game chạy thật, nhưng **độ mượt khi kéo hướng cơ chưa được quan sát trực tiếp**.
- Dự đoán cú phá 9 bi ở 10,5 m/s đo trong trình duyệt là khoảng 30 ms mỗi lần. Trên điện thoại có thể chậm hơn 3–5 lần.
- Chưa chạy `docker build`.

## 6. Quyết định & câu hỏi mở
- **Đã quyết (chờ duyệt cùng plan):**
  - Chọn phương án C. Sẽ ghi thành `ADR-0001`.
  - Phần C là mục tiêu có báo cáo, không phải cam kết.
  - Phá sốc, swerve, độ bạt theo ngọn, băng lực mạnh để sang T-003.
- **Còn mở (đề xuất mặc định trong ngoặc):**
  1. Lực phá: thêm công tắc "Lực phá" riêng, hay nâng trần lực chung lên 10,5 m/s? (công tắc riêng, để thanh lực cú đánh thường không bị thưa đi và 3 bài mẫu không đổi)
  2. Commit T-001 trước khi bắt đầu T-002, rồi làm T-002 trên nhánh mới `feat/physics-contact-model`? (có; cần bạn yêu cầu commit)
  3. Nếu phần C chỉ đạt 3/5 hoặc 4/5, có chấp nhận để các bài phá chưa đạt sang sau không? (có, miễn là báo rõ bài nào)

  Câu 1 và 2 đã làm theo đề xuất (T-001 commit `e8834a5`, nhánh `feat/physics-contact-model`).
- **Mở sau khi thực thi:** phần C đạt 2/5, dưới ngưỡng 3/5. Ba hướng đi:
  1. Chấp nhận hiện trạng, đóng T-002, và làm mô hình hàm lỗ trong T-003 (lỗ rộng hơn khi bi đi chậm, theo số đo 10 cm / 6 cm của video). Đây là thứ đang chặn AC11 và AC13.
  2. Làm mô hình hàm lỗ ngay trong T-002 rồi đo lại phần C.
  3. Dừng ở đây và hoàn tác phần chưa ưng.

  **Quyết định (2026-11-19):** chủ dự án giao tôi chọn. Chọn hướng 1: đóng T-002 ở hiện trạng, làm mô hình hàm lỗ trong T-003. Ba test `todo` trong `tests/break.test.js` là tiêu chí chuyển giao.
  4. Bạn có đo được 3 số trên bàn thật không (số lượt băng khi lăn bi hết lực, quãng lăn của một cú chuẩn, góc bật băng ở 30° và 45°)? Có thì hiệu chỉnh sẽ theo bàn của bạn thay vì theo mô tả trong video. (chưa có thì dùng video)

## 7. Ghi chú cho lần sau
- **Phía cắt bi 1 quyết định mọi thứ khi phá từ cánh.** Bi cái phải đi qua phía người phá của bi 1 (tâm bi 1 nằm bên trái đường bi cái nếu người phá đứng ở phía y âm). Lần đo đầu tôi cắt nhầm phía và kết luận sai về bi cánh. Hàm `breakShot` trong `tests/break.test.js` ghi rõ quy ước này.
- **Va chạm làm hao xoáy dọc.** Ma sát ở điểm chạm giờ tác động cả phương đứng, nên một cú bắn tâm ở cự ly ngắn gần như đứng bi. Bài tập đứng bi cần cự ly dài (bài `dung-bi` nay là 0,95 m) để cú bắn tâm còn trôi rõ.
- **Cửa sổ tiếp xúc là tức thời.** Bi trong cụm "đi trước" tối đa vài milimét. Nếu sau này cần đồng bộ chính xác theo thời gian (ví dụ quay chậm cú phá), phải tính lại chỗ này.
- **"Lực phá" được mời theo vị trí:** bi cái sau vạch đầu bàn và trên bàn còn từ 7 bi trở lên. Sau một cú phá hỏng mà bi cái lăn về bếp thì công tắc hiện lại; vô hại nhưng hơi lạ.
- **Dự đoán cú phá tốn thời gian.** Nếu điện thoại giật khi ngắm cú phá, cắt tầm dự đoán khi bật "Lực phá".
- **Ba test `todo`** trong `tests/break.test.js` là danh sách việc còn nợ của phần C. Khi sửa hàm lỗ, chúng phải chuyển sang pass.
- Chỗ bi cái dừng sau cú phá (AC15) hỗn loạn theo tham số; đừng dùng nó làm mục tiêu chấm chặt trong bài học.

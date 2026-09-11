# Ôn tập ISTQB CTFL v4.0.1 — Mục 1.1–1.3

Ngày ghi nhận: 07/09/2026. Mục tiêu: thi CTFL tiếng Việt tháng 11/2026.

## Tiến độ đã xác nhận

- Đã giảng và luyện câu ngắn: mục 1.1, 1.2, 1.3.
- Đã bắt đầu 1.4.1: lập kế hoạch, giám sát và kiểm soát; tạm dừng để củng cố.
- Đã sửa nhầm lẫn lỗi/sự cố; cần kiểm tra lại sau một khoảng thời gian.
- Đã làm đúng các tình huống phân biệt nguyên tắc kiểm thử. Không yêu cầu thuộc số thứ tự.
- Chưa có kết quả ôn trên web, bài đánh giá toàn chương hoặc đề mới có bấm giờ. Không suy ra mức sẵn sàng thi từ câu hỏi ngay sau bài giảng.

## Quy ước ôn tập đã thống nhất

Luôn xuất JSON flashcard và MCQ riêng. Mỗi lượt ôn có ít nhất 15 câu trắc nghiệm; lượt này có 20 câu. Các câu kiểm tra ngắn trong khi giảng không thay thế bài ôn tập.

## Nhập vào web

1. Tại https://flashcard-medicine.vercel.app/import/flashcard, chọn môn ISTQB và bộ ôn mục 1.1–1.3, chọn Import JSON rồi dán toàn bộ `istqb-1.1-1.3-flashcards.json` (24 thẻ).
2. Tại https://flashcard-medicine.vercel.app/import/mcq, chọn cùng môn và bộ thẻ, chọn Import JSON rồi dán toàn bộ `istqb-1.1-1.3-mcq.json` (20 câu).
3. Cả hai file là mảng JSON độc lập, đúng dạng đầu vào hai trang. Đã kiểm tra cấu trúc theo code; chưa nhập trên tài khoản.

Hai file riêng thay thế cách dùng file gộp cũ. Nếu đã nhập file gộp trước đó, không nhập lại cùng nội dung vì sẽ trùng; cần xác định nội dung đã có trước khi bổ sung. File JSON gộp cũ đã được xóa; sử dụng hai file riêng ở trên.

## Buổi củng cố 40–50 phút

1. Đọc tóm tắt bên dưới trong 5 phút.
2. Học 8 thẻ mới trước, tự trả lời rồi mới lật. Đánh giá theo khả năng nhớ thật; không bấm dễ chỉ vì thấy đáp án quen.
3. Làm 20 câu luyện tập, không xem giải thích trước. Nếu giới hạn phiên chỉ hiện một phần, dùng chế độ học tất cả của bộ.
4. Xem giải thích câu sai và câu đúng do đoán; ghi lỗi do kiến thức, nhầm khái niệm hoặc đọc sót.
5. Gửi giáo viên: số đúng/20, số câu sai và số câu đúng nhưng còn phân vân.

Đây là bài củng cố có nội dung quen, không dùng điểm để kết luận sẵn sàng thi. Những thẻ mới còn lại chia cho các ngày sau; ưu tiên thẻ đến hạn. Bộ đề mẫu A chưa đưa vào bộ học này.

## Tóm tắt kiến thức

### Mục 1.1

Kiểm thử gồm nhiều hoạt động nhằm phát hiện lỗi và đánh giá chất lượng sản phẩm công việc. Kiểm thử tĩnh không thực thi phần mềm; kiểm thử động có thực thi. Xác minh đối chiếu với yêu cầu đã mô tả; thẩm định đánh giá đáp ứng nhu cầu người dùng và các bên liên quan trong môi trường vận hành.

Mục tiêu kiểm thử bao gồm đánh giá sản phẩm, phát hiện sự cố và tìm lỗi, đảm bảo độ bao phủ cần thiết, giảm rủi ro chất lượng, xác minh yêu cầu và sự tuân thủ, hỗ trợ quyết định, tăng niềm tin, thẩm định tính hoàn chỉnh và hoạt động theo mong đợi. Không chứng minh được phần mềm hoàn toàn hết lỗi.

Gỡ lỗi sau sự cố do kiểm thử động phát hiện gồm tái hiện, chẩn đoán và sửa lỗi. Kiểm thử xác nhận kiểm tra bản sửa đã giải quyết sự cố ban đầu. Kiểm thử hồi quy xem thay đổi có ảnh hưởng bất lợi không. Phân loại theo hoạt động, không theo người thực hiện.

### Mục 1.2

Kiểm thử phát hiện lỗi để lỗi được loại bỏ bằng gỡ lỗi, nên gián tiếp góp phần nâng cao chất lượng. Nó cũng hỗ trợ quyết định, đại diện gián tiếp cho nhu cầu người dùng và giúp đáp ứng nghĩa vụ hợp đồng, pháp lý, tiêu chuẩn.

Kiểm thử hướng sản phẩm, mang tính khắc phục và là một hình thức QC. QA hướng quy trình, mang tính phòng ngừa và là trách nhiệm của mọi người trong dự án.

- Sai sót (error): con người làm sai.
- Lỗi (defect): khiếm khuyết trong sản phẩm công việc, có thể phát hiện trước khi chạy.
- Sự cố (failure): hành vi không đúng khi thực thi.
- Nguyên nhân gốc rễ: lý do căn bản được xác định qua phân tích; xử lý giúp giảm tái diễn.

Lỗi không nhất thiết gây sự cố ở mọi lần chạy; sự cố cũng có thể do điều kiện môi trường.

### Mục 1.3

- Kiểm thử cho thấy sự tồn tại của lỗi, chứ không phải sự vắng mặt của lỗi: không tìm thấy lỗi không chứng minh hết lỗi.
- Kiểm thử vét cạn là không thể: trừ trường hợp đơn giản, cần chọn kiểm thử bằng kỹ thuật, ưu tiên và rủi ro.
- Kiểm thử sớm giúp tiết kiệm thời gian và chi phí: loại bỏ lỗi sớm để tránh ảnh hưởng về sau.
- Lỗi có xu hướng tập trung: một số ít thành phần thường chứa phần lớn lỗi; không bắt buộc đúng tỷ lệ 80/20.
- Test case giảm hiệu quả theo thời gian: cập nhật test và dữ liệu để tìm lỗi mới; test hồi quy cũ vẫn có thể hữu ích.
- Kiểm thử phụ thuộc vào ngữ cảnh: điều chỉnh cách tiếp cận theo bối cảnh.
- Ngộ nhận về việc không có lỗi: đúng đặc tả, sửa hết lỗi tìm thấy vẫn có thể không đáp ứng nhu cầu; cần thẩm định.

## Nguồn và phạm vi

Diễn giải để học cá nhân từ ISTQB® CTFL Syllabus v4.0.1 tiếng Việt do người học cung cấp, mục 1.1–1.3 (nội dung trang 14–17). Chủ sở hữu syllabus: ISTQB® và các tác giả. Câu hỏi và ví dụ tự soạn, không phải đề thi chính thức, không chép đề mẫu A. Phần dẫn nhập 1.1 được gắn nhãn kiến thức nền; các phần có mục tiêu học tập được gắn mã FL và mức K tương ứng. Bộ này hỗ trợ củng cố, không thay thế syllabus hay đánh giá đầy đủ toàn chương.

Bài tiếp theo: tiếp tục mục 1.4.1 sau khi chữa lượt ôn này; sau đó học 1.4.2–1.4.5 và 1.5 theo kế hoạch tuần đầu.

# Flashcard Medicine

Website tự học với flashcard FSRS, trắc nghiệm, nhập tài liệu và lịch sử học.

## Chạy local

```sh
npm ci
npm run dev
```

Tạo `.env.local` với cấu hình của bạn (không commit file này):

```dotenv
MONGODB_URI=mongodb+srv://...
AUTH_SECRET=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
# Tuỳ chọn, chỉ cần khi sử dụng tạo thẻ bằng AI:
OPENAI_API_KEY=...
# Tuỳ chọn: chỉ cho các email này sử dụng AI; phân cách bằng dấu phẩy:
AI_ALLOWED_EMAILS=...
```

MongoDB cần hỗ trợ transaction: MongoDB Atlas hoặc replica set. Việc lưu thẻ, log ôn tập, kết quả MCQ và khôi phục backup sử dụng transaction để tránh ghi dở dang. App tự tạo các index cần thiết; tài khoản database cần quyền tạo index.

## Vercel Hobby

Đặt các biến môi trường ở trên trong Vercel → Project Settings → Environment Variables, rồi deploy repository. Build command là `npm run build` (`next build --webpack`, tương thích plugin PWA). Không cần cấu hình cron cho FSRS: thẻ đến hạn được tính lúc mở trang học.

Ngày học được tính theo `Asia/Ho_Chi_Minh`. File ảnh, âm thanh và tài liệu tải qua API được giới hạn 4 MB; avatar 2 MB. Hãy nén hoặc chia nhỏ file trước khi tải lên. AI tối đa 5 lần gọi/tài khoản/ngày và 20 lần/toàn website/ngày, ghi chú tối đa 20.000 ký tự. Lần gọi AI thất bại vẫn tính lượt để hạn chế việc thử liên tục phát sinh chi phí. API AI dùng chi phí từ tài khoản OpenAI riêng.

PWA không cache các API hoặc trang có dữ liệu tài khoản. Cần kết nối mạng để học và lưu tiến độ; app không có đồng bộ offline.

## Sao lưu và khôi phục

- Mở bộ thẻ → Export JSON để tải bản sao lưu định dạng `flashcard-medicine`, phiên bản 1. Bản này gồm flashcard, MCQ, thông số FSRS, ghi chú, tags, lịch sử ôn và các lần làm bài.
- Mở Import → Khôi phục bản sao lưu đầy đủ; chọn file JSON tối đa 4 MB. Dữ liệu được khôi phục vào deck mới, ánh xạ lại ID, không ghi đè deck cũ và không công khai deck tự động.
- Ảnh và âm thanh vẫn là URL tham chiếu, không nhúng file vào backup. Giữ file gốc trên Cloudinary để tiếp tục sử dụng.
- CSV và JSON xuất từ phiên bản cũ chỉ dùng nhập lại nội dung; không thể khôi phục thông tin lịch ôn vốn chưa được lưu trong file đó.
- Khi chia sẻ cho người khác mà không muốn kèm lịch sử học, dùng chức năng chia sẻ/clone deck.

Thư viện media chỉ hiển thị file thuộc tài khoản hiện tại. File đang được dùng trong thẻ/hồ sơ/ghi chú không thể xóa; cleanup chỉ xét file của chính tài khoản, đã tồn tại ít nhất 24 giờ và không còn được tham chiếu. Media cũ không có `ownerId` cần được gán chủ sở hữu qua một đợt kiểm tra dữ liệu riêng; app không tự nhận các file này cho người đăng nhập.

## Kiểm tra

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Bài test khởi chạy MongoDB replica set tạm trên localhost và không dùng URI database thật. Lần đầu sẽ tải MongoDB binary vào `/tmp/flashcard-mongo-binaries`. Test bao gồm quyền truy cập, ghi giao dịch nguyên tử, thử lại không trùng lịch ôn, chấm điểm server, backup/restore, hạn mức AI và ngày học Việt Nam.

## Giao diện học

Nút **Tập trung học / Hiện đầy đủ** bật hoặc tắt phần điều hướng và thông tin phụ. Chế độ tập trung mặc định bật trên điện thoại và ghi nhớ lựa chọn trong trình duyệt. Ghi chú, danh sách thẻ và thống kê có thể mở/thu gọn; kết quả trắc nghiệm tự mở sau khi nộp bài. Thanh tiến độ phản ánh số thẻ đã chấm hoặc câu đã trả lời trong phiên.

## Khắc phục lỗi khi chạy local

- `MissingSecret`: chạy `npm run setup:local` để tạo khóa ngẫu nhiên trong `.env.local` (giữ nguyên khóa đã cấu hình), sau đó khởi động lại `npm run dev` nếu Next chưa tự tải lại môi trường. Trên Vercel, cấu hình `AUTH_SECRET` trong Environment Variables riêng của project rồi redeploy; `.env.local` không được đưa lên Git.
- Cảnh báo hydration có `bis_skin_checked`, `bis_register` hoặc `__processed_...`: HTML đã bị tiện ích trình duyệt chèn thêm thuộc tính. Tắt quyền chạy của tiện ích đó trên localhost, hoặc thử profile trình duyệt mới/ẩn danh không bật tiện ích, rồi tải lại trang. Không thêm `suppressHydrationWarning` hàng loạt để che lỗi này.
- Nếu `Cannot read properties of undefined (reading 'M_ID')` chỉ xuất hiện ở trình duyệt có tiện ích: kiểm tra lại trong profile sạch. Nếu vẫn xuất hiện ở profile sạch, cần toàn bộ stack trace (kèm tên file/URL) để xác định nguồn.
- `MONGODB_URI` vẫn cần cấu hình riêng để đăng nhập tài khoản và sử dụng dữ liệu. Lệnh `setup:local` chỉ tạo khóa xác thực, không thiết lập database.

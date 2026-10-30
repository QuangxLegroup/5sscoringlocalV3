# Local data

Operational data is stored in PostgreSQL. Uploaded images are separated into two distinct folders under `photos/`:
- `photos/van-de-5s/MM-YYYY`: Ảnh hiện trường vấn đề 5S, bằng chứng chấm điểm 5S và ảnh hướng dẫn.
- `photos/an-toan/MM-YYYY`: Ảnh hiện trường đánh giá an toàn và ảnh sau cải tiến an toàn.

PostgreSQL stores the `/api/photos/...` reference and does not store image bytes.

Keep and back up the `photos` folder together with the PostgreSQL database so existing image references continue to work.

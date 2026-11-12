# Local data

Operational data is stored in PostgreSQL. Uploaded images are organized under `photos/` by category and processing stage:
- `photos/an-toan/anh-truoc-xu-ly/MM-YYYY`
- `photos/an-toan/anh-sau-xu-ly/MM-YYYY`
- `photos/van-de-5s/anh-truoc-xu-ly/MM-YYYY`
- `photos/van-de-5s/anh-sau-xu-ly/MM-YYYY`
- `photos/huong-dan/MM-YYYY` for guide images.
- `.thumbs/` mirrors these paths for generated thumbnails.

PostgreSQL stores the `/api/photos/...` reference and does not store image bytes.

Keep and back up the `photos` folder together with the PostgreSQL database so existing image references continue to work.

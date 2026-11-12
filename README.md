# LeGroup 5S Local Web App

Web app cham diem 5S theo bang mau `Tong Hop diem 5S thang 12.2025`.

## Ngon ngu su dung

- HTML: cau truc giao dien.
- CSS: giao dien, bang diem giong Excel, dashboard, popup.
- JavaScript thuan: dang nhap, phan quyen, cham diem, luu du lieu noi bo, xuat Excel.

Dữ liệu nghiệp vụ được lưu trong PostgreSQL. Ảnh minh họa được lưu riêng theo loại hồ sơ và kỳ: `data/photos/an-toan/anh-truoc-xu-ly/MM-YYYY`, `data/photos/an-toan/anh-sau-xu-ly/MM-YYYY`, `data/photos/van-de-5s/anh-truoc-xu-ly/MM-YYYY`, `data/photos/van-de-5s/anh-sau-xu-ly/MM-YYYY`; ảnh hướng dẫn nằm trong `data/photos/huong-dan/MM-YYYY`. Thumbnail lưu trong `.thumbs` theo cùng cấu trúc. PostgreSQL chỉ lưu đường dẫn `/api/photos/...`, không lưu nội dung ảnh.
Sau khi nhap va doi chieu PostgreSQL thanh cong, tep JSON nguon va cac ban JSON duoc to chuc lai da duoc xoa khoi may nay. Server khong doc/ghi JSON de luu du lieu khi chay.

## Chay app

Sau khi da chay `npm run migrate:postgres` thanh cong va cau hinh PostgreSQL trong `.env`, chay server noi bo:

```bash
npm start
```

Sau do mo dia chi localhost duoc in ra trong terminal, mac dinh la `http://127.0.0.1:5500`.
Cac duong dan truc tiep gom `/login`, `/home`, `/assessor`, `/summary`, `/safety`, `/issue-stats`, `/catalog` va `/accounts`.
Sau khi dang nhap, reload trinh duyet se giu phien noi bo va mo lai dung trang hien tai.
Du lieu cham diem va duong dan anh nam trong PostgreSQL; tep anh moi nam trong `data/photos/MM-YYYY`.

Nhap du lieu cu vao PostgreSQL:

```bash
npm run migrate:postgres
```

Lenh nay doc `DATA_FILE`, chi nhap vao database trong neu database ung dung dang rong, doi chieu du lieu sau nhap va kiem tra tep nguon khong thay doi trong luc chay. Neu co bat ky loi nao, giao dich PostgreSQL bi rollback. Chi dung lenh nay khi co tep JSON nguon can nhap.

## Cau truc PostgreSQL

Schema duoc tao tu `src/server/repositories/schema.sql`. Du lieu nghiep vu duoc chia vao cac bang rieng:

| Bang | Du lieu quan ly |
| --- | --- |
| `periods` | Ky cham diem va cau hinh ky |
| `accounts` | Tai khoan va quyen |
| `areas`, `safety_areas` | Zone cham diem 5S va zone an toan |
| `managers`, `assessors`, `safety_managers`, `safety_assessors` | Danh muc quan ly va assessor |
| `department_head_contacts`, `safety_department_head_contacts`, `safety_department_groups` | Truong bo phan va nhom phong ban |
| `scores` | Tung diem cham theo ky, zone va tieu chi |
| `safety_records` | Phieu danh gia an toan |
| `five_s_findings` | Phieu van de 5S |
| `five_s_finding_items` | Tung hang muc/van de va doi sach trong phieu 5S; co khoa ngoai den phieu cha |
| `deleted_safety_records` | Thong tin truy vet phieu an toan da xoa |
| `score_history` | Lich su thay doi diem |

Cac cot loc pho bien nhu ky, nam/thang, zone, trang thai va ngay co chi muc de truy van nhanh. Cot `data` JSONB trong tung bang giu cac truong mo rong cua ban ghi de tuong thich day du voi app; day la du lieu PostgreSQL, khong phai tep JSON runtime. Cau hinh he thong it thay doi nam trong `app_root_values`; `app_meta`, `app_revision`, `app_collection_shapes` va `app_schema_migrations` la cac bang ho tro. Khi nang cap database da nhap JSON, server backfill cac bang moi trong transaction, doi chieu du lieu truoc khi commit, sau do doi ten bang chung cu thanh `app_records_legacy_archive`. Bang archive duoc giu de doi chieu va app khong doc/ghi bang nay.



## Gui email bao cao DG AT

Nut `Gui bao cao` trong trang `Danh gia an toan` se tao file Excel rieng theo zone cua tung truong phong va goi API noi bo `/api/send-safety-report` de server gui tung email rieng den email truong phong da thiet lap trong `Danh muc`.
Can cau hinh SMTP truoc khi chay server; vi du tren PowerShell:

```powershell
$env:SMTP_HOST="smtp.gmail.com"
$env:SMTP_PORT="587"
$env:SMTP_USER="email@congty.com"
$env:SMTP_PASS="app-password-hoac-mat-khau-smtp"
$env:SMTP_FROM="email@congty.com"
npm start
```

Mac dinh port `587` dung STARTTLS. Neu dung SMTP SSL port `465`, dat them `$env:SMTP_SECURE="1"`.
## Luong su dung

1. Admin dang nhap, xem `Tong hop diem`, `Danh gia an toan`, `Thong ke AT`, `Danh muc` va `Tai khoan`; trang admin khong hien `Phieu cham`.
2. Admin tao ky cham moi theo thang trong `Danh muc`; co the copy danh muc nguoi tu ky dang mo hoac thiet lap lai nguoi, ky moi bat dau trong diem.
3. Admin them/sua/xoa danh muc `Assessor` rieng trong `Danh muc`, sau do khi them/sua zone se chon assessor tu dropdown.
4. Admin them/sua/xoa nguoi phu trach zone trong muc `Nguoi phu trach zone / nguoi duoc danh gia`, va thiet lap email nhan bao cao trong muc `Email truong phong`.
5. Admin sua ten zone, truong phong, nhom tong diem, nguoi phu trach zone/nguoi duoc danh gia va assessor dong cuoi trong `Danh muc` hoac ngay tren bang tong hop.
6. Admin tao/sua/xoa tai khoan assessor trong `Tai khoan`; tai khoan assessor khong dung email, zone chinh duoc lay tu danh muc zone da chon assessor, checkbox trong tai khoan chi dung de gan them zone ngoai le.
7. Assessor dang nhap se dung `Phieu cham` de cham cac zone duoc gan.
8. Tab `Tong hop diem` cua assessor hien bang tieu chuan 5S giong file `Tieu chuan 5S.2020.xlsx` de doi chieu tong quat.
9. Admin xem `Danh gia an toan` de tong hop cac ghi chu/anh theo form Hazard Identification & Activity Follow Up Sheet, sua noi dung bao cao, them anh sau cai tien, dong/mo trang thai van de, xuat file DG AT va gui rieng bao cao Excel den tung truong phong theo zone phu trach.
10. Admin xem `Thong ke AT` de dem so van de dang gap phai trong thang theo zone va STOP 6.

## Ghi chu

- Thong ke AT: so nhan dien theo thang phat hien; doi sach theo `countermeasureDate` (ngay thuc te trien khai); hoan thanh theo `completedDate` va trang thai da dong. Hai ngay thuc te khong tu dien hom nay. `completionDate` cu duoc giu de tham chieu/du kien, khong duoc dung thay ngay thuc te.
- Ban ghi cu thieu ngay van duoc giu, hien canh bao can bo sung ngay trong bao cao. Hoat dong xu ly sang nam sau duoc tinh vao nam thuc te; ti le luy ke co tinh so van de chuyen tu nam truoc vao mau so.

- Hang muc 5S co dinh theo cau hinh he thong, khong cho sua trong app.
- Moi ky danh gia co `settingsSnapshot` rieng cho danh muc nguoi, zone va thiet lap AT. Khi sua truong phong, nguoi phu trach zone hoac assessor thi chi snapshot cua ky dang mo thay doi; cac ky khac khong bi doi theo.
- Thang diem la 1 den 5, them lua chon `Gach cheo` cho o khong cham; khi chon se cap nhat hien thi o ngay trong giao dien.
- File xuat ra la `.xlsx`, gom bang diem chi tiet va bang danh gia an toan o dang bang tinh giong giao dien web, co style mau, merge cell, o `Gach cheo`, khong chen cot cong thuc phu gay loi `####`.
- Nut `Gui bao cao` gom email cua truong phong trong bao cao, loai trung, gui tung email rieng qua SMTP voi file Excel da loc theo zone cua tung truong phong va van cho copy email de gui thu cong khi can.

## Kien truc MVC + Layered Architecture

Frontend hien tai dong vai tro View va duoc tach theo page module:

- `index.html`: khung giao dien va cac panel chua trang.
- `styles.css`: style giao dien.
- `app.js`: app shell/router phia client, validate thao tac nguoi dung va cung cap context dung chung cho cac page.
- `modules/core/page-registry.js`: dang ky va render cac page theo id.
- `modules/local-data-api.js`: client data gateway, giu API gan giong Firebase de app cu it phai thay doi.
- `modules/pages/admin-home-page.js`: trang card menu admin.
- `modules/pages/summary-page.js`: trang `Tong hop diem`.
- `modules/pages/safety-page.js`: trang `Danh gia an toan`.
- `modules/pages/issue-stats-page.js`: trang `Thong ke an toan`.
- `modules/pages/assessor-page.js`, `catalog-page.js`, `accounts-page.js`: cac page module wrapper cho nhung trang con lai, san sang tach logic rieng tiep.

Backend Node duoc tach theo Controller-Service-Repository:

- `server.js`: composition root, khoi tao dependency va lang nghe port.
- `src/server/app-server.js`: router HTTP tong, dieu phoi API va static files.
- `src/server/controllers/data-controller.js`: Controller cho `/api/health`, `/api/data`, `/api/data/write` va `/api/photos`.
- `src/server/controllers/static-file-controller.js`: Controller phuc vu file giao dien.
- `src/server/services/data-service.js`: Service xu ly lenh `set`, `update`, `remove` tren state va luu/doc anh trong `data/photos`.
- `src/server/services/static-file-service.js`: Service doc file UI duoc phep public.
- `src/server/config/database-config.js`: nap cau hinh `.env` va tao thong so ket noi PostgreSQL.
- `src/server/repositories/postgres-repository.js`: repository PostgreSQL; luu cac ban ghi lon theo hang, tao index theo ky/thang, zone va trang thai, ho tro phan trang.
- `src/server/repositories/json-file-repository.js`: repository cu, chi duoc giu de phuc vu cac cong cu legacy; server production khong khoi tao repository nay.
- `scripts/migrate-json-to-postgres.js`: nhap mot lan du lieu JSON cu, co transaction, checksum va doi chieu truoc khi commit.
- `src/server/http/request.js` va `src/server/http/response.js`: helper HTTP dung chung.

Luồng lưu dữ liệu: View -> `local-data-api.js` -> DataController -> DataService -> PostgreSQL repository. Các danh sách lớn có endpoint phân trang `/api/data/page`; kiểm tra thay đổi sử dụng ETag để không tải lại toàn bộ root khi dữ liệu không đổi. Ảnh đi qua `/api/photos` -> thư mục theo loại hồ sơ, ảnh trước/sau xử lý và kỳ trong `data/photos`.
## Chay bang Docker production

Cau hinh Docker dung image Debian-based, khong dung Alpine:

- Backend: `node:20-bookworm-slim`, cai `openssl` o ca build stage va runtime stage.
- Frontend: copy static assets bang Node Debian image va serve bang `nginx:stable-bookworm`.
- Nginx proxy `/api` ve service `backend`, nen may khac trong LAN chi can vao frontend port va API van la same-origin.
- Anh upload duoc bind mount tu thu muc `data` vao `/app/data`; database PostgreSQL nam tren may host.

Chay production stack:

```powershell
# Cau hinh .env, bat PostgreSQL tren may host va nhap du lieu cu mot lan.
npm run migrate:postgres
# Khoi dong app sau khi migration thanh cong.
docker compose up -d --build
```

Backend trong Docker dung `host.docker.internal:5432` de noi toi PostgreSQL tren Windows host. Neu PostgreSQL chi nghe `localhost`, can cho phep ket noi tu Docker gateway trong `postgresql.conf` va `pg_hba.conf` truoc khi chay stack. Thu muc `data/photos` chua cac tep anh app dang su dung; can giu va sao luu cung PostgreSQL.

Docker Compose phuc vu frontend qua HTTP tren cong host `5500` (co the doi bang `FRONTEND_PORT`). Cac may tinh bang trong cung mang noi bo truy cap `http://<IP-LAN-cua-may-chu>:5500`; backend API chi bind loopback va duoc frontend proxy noi bo. Neu IP LAN thay doi, cap nhat `APP_URL` va `CORS_ORIGIN` trong `.env`. Khong chay dong thoi `npm start` va frontend Docker tren cung cong 5500.

Truoc khi trien khai: sao luu PostgreSQL va thu muc `data` (bao gom anh). Backend dung PostgreSQL duy nhat; neu chua co du lieu, no se dung khoi dong va yeu cau chay migration. Docker Compose khong tao them database container vi PostgreSQL dang chay tren may host.

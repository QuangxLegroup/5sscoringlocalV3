# LeGroup 5S Local Web App

Web app cham diem 5S theo bang mau `Tong Hop diem 5S thang 12.2025`.

## Ngon ngu su dung

- HTML: cau truc giao dien.
- CSS: giao dien, bang diem giong Excel, dashboard, popup.
- JavaScript thuan: dang nhap, phan quyen, cham diem, luu du lieu noi bo, xuat Excel.

Hien tai app luu file JSON noi bo trong folder `data` cua project. Anh minh hoa duoc nen JPEG va luu rieng theo thang-nam trong `data/photos/MM-YYYY`.
Server Node nho trong `server.js` phuc vu giao dien va ghi du lieu noi bo, khong dung Firebase nua.

## Chay app

Chay server noi bo:

```bash
npm start
```

Sau do mo dia chi localhost duoc in ra trong terminal, mac dinh la `http://127.0.0.1:5175`.
Cac duong dan truc tiep gom `/login`, `/home`, `/assessor`, `/summary`, `/safety`, `/issue-stats`, `/catalog` va `/accounts`.
Sau khi dang nhap, reload trinh duyet se giu phien noi bo va mo lai dung trang hien tai.
Du lieu cham diem se nam tai `data/runtime/main-data.json`; anh moi se nam trong `data/photos/MM-YYYY` va file JSON chi giu duong dan anh.



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

- Hang muc 5S co dinh theo file mau, khong cho sua trong app.
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
- `src/server/repositories/json-file-repository.js`: Repository doc/ghi atomic file `data/runtime/main-data.json`.
- `src/server/http/request.js` va `src/server/http/response.js`: helper HTTP dung chung.

Luong luu du lieu: View -> `local-data-api.js` -> DataController -> DataService -> JsonFileRepository -> `data/runtime/main-data.json`; anh di qua `/api/photos` -> `data/photos/MM-YYYY`.
## Chay bang Docker production

Cau hinh Docker dung image Debian-based, khong dung Alpine:

- Backend: `node:20-bookworm-slim`, cai `openssl` o ca build stage va runtime stage.
- Frontend: copy static assets bang Node Debian image va serve bang `nginx:stable-bookworm`.
- Nginx proxy `/api` ve service `backend`, nen may khac trong LAN chi can vao frontend port va API van la same-origin.
- Du lieu JSON va anh upload duoc luu trong thu muc `data` cua project, duoc bind mount vao `/app/data`.

Chay production stack:

```bash
docker compose up -d --build
```

Mac dinh frontend mo o `http://localhost:8080`, backend API truc tiep o `http://localhost:5175/api/health`. Co the copy `.env.example` thanh `.env` de doi port, CORS, SMTP hoac cac bien san sang cho database/JWT neu sau nay backend duoc nang cap.

Du an hien tai khong dung Prisma va khong co `schema.prisma`, nen khong can `binaryTargets`, migrate, db push hay seed. Du an cung khong dung PostgreSQL trong source hien tai, vi vay compose khong tao database service thua.

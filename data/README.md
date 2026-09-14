# Local data

Server se tu tao file `runtime/main-data.json` trong thu muc nay khi app chay lan dau.
Khi chay Docker, thu muc nay duoc gan truc tiep vao `/app/data` de de tim, sao luu va chuyen may.

File `runtime/main-data.json` la file du lieu chinh ma app doc/ghi.
Neu may dang co file cu `legroup-5s.json`, app se tu doc va tao lai file moi trong `runtime/` khi khoi dong.
Thu muc `organized/` duoc tao lai tu dong moi lan co thay doi du lieu, dung de xem nhanh theo tung chu de:

- `organized/cham-5s/<nam>/<thang>.json`: diem cham 5S theo ky.
- `organized/danh-gia-an-toan/<nam>/<thang>.json`: ban ghi danh gia an toan theo ky.
- `organized/danh-muc/`: ky danh gia, zone, nhom AT, assessor/manager va target.
- `organized/tai-khoan/`: tai khoan va lich su phien.
- `organized/he-thong/`: thong tin he thong.

Khong sua tay cac file trong `organized/` khi app dang chay vi app se tu tao lai tu file du lieu chinh.

Thu muc `samples/` chua cac file JSON mau theo tung trang, khong chua tai khoan hay mat khau.

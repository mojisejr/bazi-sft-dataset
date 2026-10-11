## Summary


## Deploy impact — merge ขึ้น staging เอง · production = owner กด
- [ ] เข้าใจว่า merge เข้า `pdf-dev` = build image แล้ว **ขึ้น staging เอง** (ราว 10 นาที · Discord บอก `🧪 staging พร้อมทดสอบ`) · **production ขึ้นเมื่อ owner กดเท่านั้น** (หลังทดสอบบน staging แล้วบอก owner)
- [ ] migration ของฐาน: ไม่มี — หรือมี และ **รันบนฐาน production แล้วก่อน merge** (additive เท่านั้น) + บอก owner/agent ให้รันบนฐาน staging ด้วย
- [ ] env ใหม่: ไม่มี — หรือมี และบอก owner แล้ว (ต้องวางบนเครื่อง production ก่อนกด)

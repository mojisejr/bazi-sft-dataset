// scripts/seed-sacred-map-famous.ts — เติม "แผนที่มู" ด้วยวัด/ศาลดังทั่วไทย (เอ็ม 2026-09-23).
//   ข้อความคัดเอง (ชื่อ/จังหวัด/เทพ/ขอพร/วิธีไหว้/พิกัด). รูป = ดึง "ภาพนำบทความ" จาก Wikipedia ตอนรัน
//   (รูปวัดจริง ลิขสิทธิ์ CC จาก Wikimedia) → set image_url. ไม่มีบทความ/รูป → ปล่อยว่าง (FE ขึ้น 🙏).
//   idempotent: ข้ามที่มีชื่อซ้ำอยู่แล้ว. รัน: node --env-file=.env --import tsx scripts/seed-sacred-map-famous.ts
import { createLocation, listVerified } from "@/lib/bazi/sacred-map/repository";

type El = "wood" | "fire" | "earth" | "metal" | "water";
type Place = {
  name: string; province: string; deity?: string; description: string; address: string;
  lat: number; lng: number; element: El; needs: string[]; worshipGuide: string;
  wikiTh?: string; wikiEn?: string;
};

const PLACES: Place[] = [
  { name: "วัดพระศรีรัตนศาสดาราม (วัดพระแก้ว)", province: "กรุงเทพมหานคร", deity: "พระพุทธมหามณีรัตนปฏิมากร (พระแก้วมรกต)", description: "พระอารามศักดิ์สิทธิ์คู่บ้านคู่เมือง ขอพรเรื่องความเจริญรุ่งเรือง สติปัญญา และความเป็นสิริมงคลของชีวิต", address: "ในพระบรมมหาราชวัง ถนนหน้าพระลาน เขตพระนคร", lat: 13.7515, lng: 100.4927, element: "earth", needs: ["จิตใจ", "การงาน", "สุขภาพ"], worshipGuide: "ดอกบัว ธูปเทียน กราบสักการะด้วยใจสงบ ตั้งจิตอธิษฐานขอพร", wikiTh: "วัดพระศรีรัตนศาสดาราม", wikiEn: "Wat Phra Kaew" },
  { name: "วัดพระเชตุพนวิมลมังคลาราม (วัดโพธิ์)", province: "กรุงเทพมหานคร", deity: "พระพุทธไสยาส (พระนอน)", description: "ขอพรเรื่องสุขภาพ การรักษาโรค และความสงบทางใจ ยอดวัดแห่งการแพทย์แผนไทย", address: "ถนนสนามไชย แขวงพระบรมมหาราชวัง เขตพระนคร", lat: 13.7465, lng: 100.4933, element: "earth", needs: ["สุขภาพ", "จิตใจ"], worshipGuide: "ธูปเทียน ดอกไม้ หยอดเหรียญลงบาตร 108 ใบ เพื่อความเป็นสิริมงคล", wikiTh: "วัดพระเชตุพนวิมลมังคลารามราชวรมหาวิหาร", wikiEn: "Wat Pho" },
  { name: "วัดอรุณราชวราราม (วัดแจ้ง)", province: "กรุงเทพมหานคร", deity: "พระปรางค์วัดอรุณ", description: "ขอพรเรื่องชีวิตรุ่งอรุณสดใส เริ่มต้นใหม่ การงานก้าวหน้า", address: "ถนนวังเดิม แขวงวัดอรุณ เขตบางกอกใหญ่", lat: 13.7437, lng: 100.4889, element: "earth", needs: ["การงาน", "จิตใจ"], worshipGuide: "ธูปเทียน ดอกไม้ กราบพระประธานและพระปรางค์", wikiTh: "วัดอรุณราชวรารามราชวรมหาวิหาร", wikiEn: "Wat Arun" },
  { name: "วัดไตรมิตรวิทยาราม (หลวงพ่อทองคำ)", province: "กรุงเทพมหานคร", deity: "พระพุทธมหาสุวรรณปฏิมากร (หลวงพ่อทองคำ)", description: "พระพุทธรูปทองคำใหญ่ที่สุดในโลก ขอพรเรื่องเงินทอง โชคลาภ ความมั่งคั่ง", address: "ถนนเจริญกรุง แขวงตลาดน้อย เขตสัมพันธวงศ์", lat: 13.7385, lng: 100.5133, element: "metal", needs: ["เงิน", "โชคลาภ", "การงาน"], worshipGuide: "ธูปเทียน ทองคำเปลว ปิดทองขอพรเรื่องทรัพย์", wikiTh: "วัดไตรมิตรวิทยารามวรวิหาร", wikiEn: "Wat Traimit" },
  { name: "วัดสระเกศ (ภูเขาทอง)", province: "กรุงเทพมหานคร", deity: "พระบรมสารีริกธาตุ บนบรมบรรพต", description: "ขอพรเรื่องความก้าวหน้าสูงขึ้นในชีวิต ปลดเปลื้องทุกข์ ใจสงบ", address: "ถนนบริพัตร แขวงบ้านบาตร เขตป้อมปราบฯ", lat: 13.7539, lng: 100.5069, element: "earth", needs: ["จิตใจ", "การงาน"], worshipGuide: "ธูปเทียน ดอกไม้ เดินขึ้นสักการะพระบรมสารีริกธาตุบนยอด", wikiTh: "วัดสระเกศราชวรมหาวิหาร", wikiEn: "Wat Saket" },
  { name: "วัดเบญจมบพิตรดุสิตวนาราม", province: "กรุงเทพมหานคร", deity: "พระพุทธชินราช (จำลอง)", description: "วัดหินอ่อน ขอพรเรื่องความสง่างาม เกียรติยศ ความเจริญ", address: "ถนนนครปฐม แขวงดุสิต เขตดุสิต", lat: 13.7669, lng: 100.5142, element: "earth", needs: ["การงาน", "จิตใจ"], worshipGuide: "ธูปเทียน ดอกไม้ กราบพระพุทธชินราช", wikiTh: "วัดเบญจมบพิตรดุสิตวนารามราชวรวิหาร", wikiEn: "Wat Benchamabophit" },
  { name: "วัดพระปฐมเจดีย์", province: "นครปฐม", deity: "พระร่วงโรจนฤทธิ์ / องค์พระปฐมเจดีย์", description: "เจดีย์ใหญ่ที่สุดในไทย ขอพรเรื่องความมั่นคง จิตใจ และปณิธานที่ตั้งไว้", address: "ถนนขวาพระ ตำบลพระปฐมเจดีย์ อำเภอเมือง", lat: 13.8199, lng: 100.0621, element: "earth", needs: ["จิตใจ", "สุขภาพ"], worshipGuide: "ธูปเทียน ดอกบัว บนบานพระร่วงโรจนฤทธิ์ด้วยดอกไม้พวงมาลัย", wikiTh: "วัดพระปฐมเจดีย์ราชวรมหาวิหาร", wikiEn: "Phra Pathommachedi" },
  { name: "วัดโสธรวรารามวรวิหาร (หลวงพ่อโสธร)", province: "ฉะเชิงเทรา", deity: "หลวงพ่อพุทธโสธร", description: "พระพุทธรูปศักดิ์สิทธิ์ ขอพรเรื่องสุขภาพหายเจ็บป่วย โชคลาภ ค้าขาย", address: "ถนนมรุพงษ์ ตำบลหน้าเมือง อำเภอเมือง", lat: 13.6836, lng: 101.0703, element: "water", needs: ["สุขภาพ", "โชคลาภ", "การงาน"], worshipGuide: "ไข่ต้ม พวงมาลัย ธูปเทียน บนบานด้วยละครชาตรี", wikiTh: "วัดโสธรวรารามวรวิหาร", wikiEn: "Wat Sothon Wararam Worawihan" },
  { name: "วัดใหญ่ชัยมงคล", province: "พระนครศรีอยุธยา", deity: "เจดีย์ชัยมงคล / พระนอน", description: "ขอพรเรื่องชัยชนะ ความสำเร็จ หน้าที่การงาน ก้าวข้ามอุปสรรค", address: "ตำบลคลองสวนพลู อำเภอพระนครศรีอยุธยา", lat: 14.3441, lng: 100.5920, element: "earth", needs: ["การงาน", "จิตใจ"], worshipGuide: "ธูปเทียน ดอกไม้ ผ้าแพรพันเจดีย์ ขอพรเรื่องชัยชนะ", wikiTh: "วัดใหญ่ชัยมงคล", wikiEn: "Wat Yai Chai Mongkhon" },
  { name: "วัดพนัญเชิงวรวิหาร (หลวงพ่อโต)", province: "พระนครศรีอยุธยา", deity: "พระพุทธไตรรัตนนายก (หลวงพ่อโต / ซำปอกง)", description: "ขอพรเรื่องการค้าขาย เงินทอง เดินทางปลอดภัย ที่ชาวไทย-จีนศรัทธา", address: "ตำบลคลองสวนพลู อำเภอพระนครศรีอยุธยา", lat: 14.3453, lng: 100.5799, element: "earth", needs: ["เงิน", "การงาน", "โชคลาภ"], worshipGuide: "ธูปเทียน พวงมาลัย ผ้าไตร ปิดทองขอพรค้าขาย", wikiTh: "วัดพนัญเชิงวรวิหาร", wikiEn: "Wat Phanan Choeng" },
  { name: "วัดมหาธาตุ (เศียรพระในรากไม้)", province: "พระนครศรีอยุธยา", deity: "เศียรพระพุทธรูปในรากไม้", description: "โบราณสถานมรดกโลก ขอพรเรื่องความสงบใจ ศรัทธา และการหยั่งราก", address: "ถนนชีกุน ตำบลท่าวาสุกรี อำเภอพระนครศรีอยุธยา", lat: 14.3570, lng: 100.5679, element: "earth", needs: ["จิตใจ"], worshipGuide: "สักการะด้วยใจสงบ ธูปเทียนดอกไม้ที่จุดที่จัดไว้", wikiTh: "วัดมหาธาตุ (จังหวัดพระนครศรีอยุธยา)", wikiEn: "Wat Mahathat, Ayutthaya" },
  { name: "วัดพระธาตุดอยสุเทพ", province: "เชียงใหม่", deity: "พระธาตุดอยสุเทพ", description: "พระธาตุคู่เมืองเชียงใหม่ ขอพรเรื่องความเจริญรุ่งเรือง สุขภาพ และสมหวังตามปณิธาน", address: "ดอยสุเทพ ตำบลสุเทพ อำเภอเมืองเชียงใหม่", lat: 18.8049, lng: 98.9217, element: "earth", needs: ["จิตใจ", "สุขภาพ", "การงาน"], worshipGuide: "ดอกไม้ ธูปเทียน เดินเวียนประทักษิณรอบองค์พระธาตุ 3 รอบ", wikiTh: "วัดพระธาตุดอยสุเทพราชวรวิหาร", wikiEn: "Wat Phra That Doi Suthep" },
  { name: "วัดพระสิงห์", province: "เชียงใหม่", deity: "พระพุทธสิหิงค์", description: "ขอพรเรื่องความเป็นสิริมงคล สติปัญญา และความสงบทางใจ", address: "ถนนสามล้าน ตำบลพระสิงห์ อำเภอเมืองเชียงใหม่", lat: 18.7883, lng: 98.9817, element: "earth", needs: ["จิตใจ", "การงาน"], worshipGuide: "ธูปเทียน ดอกไม้ สรงน้ำพระพุทธสิหิงค์ในวันสงกรานต์", wikiTh: "วัดพระสิงห์วรมหาวิหาร", wikiEn: "Wat Phra Singh" },
  { name: "วัดร่องขุ่น (White Temple)", province: "เชียงราย", deity: "พระประธานในอุโบสถขาว", description: "วัดศิลปะสีขาวชื่อดัง ขอพรเรื่องความบริสุทธิ์ เริ่มต้นใหม่ ปลดเปลื้องกรรม", address: "ตำบลป่าอ้อดอนชัย อำเภอเมืองเชียงราย", lat: 19.8244, lng: 99.7631, element: "metal", needs: ["จิตใจ"], worshipGuide: "เดินข้ามสะพานวัฏสงสาร ตั้งจิตปล่อยวางก่อนเข้าสักการะ", wikiTh: "วัดร่องขุ่น", wikiEn: "Wat Rong Khun" },
  { name: "วัดร่องเสือเต้น (Blue Temple)", province: "เชียงราย", deity: "พระพุทธรัชมงคลบดีตรีโลกนาถ", description: "วิหารสีน้ำเงินงดงาม ขอพรเรื่องความสงบใจ ปัญญา และแรงบันดาลใจ", address: "ตำบลริมกก อำเภอเมืองเชียงราย", lat: 19.9251, lng: 99.8493, element: "water", needs: ["จิตใจ"], worshipGuide: "ธูปเทียน ดอกไม้ กราบพระประธานสีขาวในวิหารน้ำเงิน", wikiTh: "วัดร่องเสือเต้น", wikiEn: "Wat Rong Suea Ten" },
  { name: "วัดพระธาตุลำปางหลวง", province: "ลำปาง", deity: "พระธาตุลำปางหลวง", description: "พระธาตุประจำปีเกิดปีฉลู ขอพรเรื่องความมั่นคง จิตใจ และบารมี", address: "ตำบลลำปางหลวง อำเภอเกาะคา", lat: 18.2189, lng: 99.3760, element: "earth", needs: ["จิตใจ"], worshipGuide: "ดอกไม้ ธูปเทียน ชมเงาพระธาตุกลับหัวในวิหารมืด", wikiTh: "วัดพระธาตุลำปางหลวง", wikiEn: "Wat Phra That Lampang Luang" },
  { name: "วัดพระธาตุหริภุญชัย", province: "ลำพูน", deity: "พระธาตุหริภุญชัย", description: "พระธาตุประจำปีเกิดปีระกา ขอพรเรื่องความสำเร็จ หน้าที่การงาน และสิริมงคล", address: "ถนนอินทยงยศ ตำบลในเมือง อำเภอเมืองลำพูน", lat: 18.5772, lng: 99.0086, element: "earth", needs: ["จิตใจ", "การงาน"], worshipGuide: "ดอกไม้ ธูปเทียน เวียนเทียนรอบองค์พระธาตุ", wikiTh: "วัดพระธาตุหริภุญชัยวรมหาวิหาร", wikiEn: "Wat Phra That Hariphunchai" },
  { name: "วัดพระธาตุช่อแฮ", province: "แพร่", deity: "พระธาตุช่อแฮ", description: "พระธาตุประจำปีเกิดปีขาล ขอพรเรื่องความเจริญ ปลอดภัย และสมหวัง", address: "ตำบลช่อแฮ อำเภอเมืองแพร่", lat: 18.1103, lng: 100.2109, element: "earth", needs: ["จิตใจ", "การงาน"], worshipGuide: "ดอกไม้ ธูปเทียน ผ้าแพรสีบูชาพันองค์พระธาตุ", wikiTh: "วัดพระธาตุช่อแฮ", wikiEn: "Wat Phra That Cho Hae" },
  { name: "วัดพระธาตุพนม", province: "นครพนม", deity: "พระธาตุพนม", description: "พระธาตุศักดิ์สิทธิ์แห่งลุ่มน้ำโขง ขอพรเรื่องความมั่นคง การงาน เงินทอง และชีวิตรุ่งเรือง", address: "ตำบลธาตุพนม อำเภอธาตุพนม", lat: 16.9430, lng: 104.7218, element: "earth", needs: ["จิตใจ", "การงาน", "เงิน"], worshipGuide: "ดอกไม้ ธูปเทียน ข้าวตอกดอกไม้ เวียนประทักษิณรอบองค์พระธาตุ", wikiTh: "วัดพระธาตุพนมวรมหาวิหาร", wikiEn: "Wat Phra That Phanom" },
  { name: "วัดพระธาตุเชิงชุม", province: "สกลนคร", deity: "พระธาตุเชิงชุม / หลวงพ่อพระองค์แสน", description: "ขอพรเรื่องความสำเร็จ จิตใจมั่นคง และครอบครัวเป็นสุข", address: "ถนนเจริญเมือง ตำบลธาตุเชิงชุม อำเภอเมืองสกลนคร", lat: 17.1564, lng: 104.1487, element: "earth", needs: ["จิตใจ", "การงาน"], worshipGuide: "ดอกไม้ ธูปเทียน กราบหลวงพ่อพระองค์แสน", wikiTh: "วัดพระธาตุเชิงชุมวรวิหาร", wikiEn: "Wat Phra That Choeng Chum" },
  { name: "ป่าคำชะโนด (วังนาคินทร์)", province: "อุดรธานี", deity: "เจ้าปู่ศรีสุทโธ-เจ้าย่าศรีปทุมมา (พญานาค)", description: "ดินแดนศักดิ์สิทธิ์พญานาค ขอพรเรื่องโชคลาภ ความสำเร็จ และสิ่งที่ปรารถนา", address: "ตำบลบ้านม่วง อำเภอบ้านดุง", lat: 17.8006, lng: 103.2635, element: "water", needs: ["โชคลาภ", "จิตใจ", "เงิน"], worshipGuide: "ดอกไม้สีขาว ธูปเทียน บายศรี น้ำแดง ถวายเจ้าปู่-เจ้าย่า ด้วยความเคารพ", wikiTh: "คำชะโนด", wikiEn: "Kham Chanot" },
  { name: "ปราสาทพนมรุ้ง", province: "บุรีรัมย์", deity: "เทวสถานพระศิวะ (ปราสาทหินโบราณ)", description: "ปราสาทหินบนปากปล่องภูเขาไฟ ขอพรเรื่องอำนาจบารมี ความสำเร็จ และปณิธานอันยิ่งใหญ่", address: "ตำบลตาเป๊ก อำเภอเฉลิมพระเกียรติ", lat: 14.5320, lng: 102.9410, element: "fire", needs: ["การงาน", "จิตใจ"], worshipGuide: "สักการะด้วยใจสงบ ดอกไม้ธูปเทียนที่จุดที่จัดไว้ ชมแสงอาทิตย์ลอดประตู 15 บาน", wikiTh: "อุทยานประวัติศาสตร์พนมรุ้ง", wikiEn: "Phanom Rung" },
  { name: "วัดญาณสังวรารามวรมหาวิหาร", province: "ชลบุรี", deity: "พระบรมธาตุเจดีย์มหาจักรีพิพัฒน์", description: "ขอพรเรื่องความสงบใจ สติปัญญา และความเจริญในธรรม", address: "ตำบลห้วยใหญ่ อำเภอบางละมุง", lat: 12.7645, lng: 100.9297, element: "earth", needs: ["จิตใจ"], worshipGuide: "ดอกไม้ ธูปเทียน กราบพระบรมสารีริกธาตุ", wikiTh: "วัดญาณสังวรารามวรมหาวิหาร", wikiEn: "Wat Yansangwararam" },
  { name: "วัดเจดีย์ (ไอ้ไข่)", province: "นครศรีธรรมราช", deity: "ตาไข่ (ไอ้ไข่ เด็กวัดเจดีย์)", description: "ขอพรเรื่องโชคลาภ ค้าขาย การงาน โด่งดังเรื่อง 'ขอได้ ไหว้รับ'", address: "ตำบลฉลอง อำเภอสิชล", lat: 8.9840, lng: 99.8975, element: "fire", needs: ["โชคลาภ", "การงาน", "เงิน"], worshipGuide: "น้ำแดง ประทัด ไก่ปูนปั้น รูปเด็ก บนบานแล้วต้องมาแก้บน", wikiTh: "วัดเจดีย์ (จังหวัดนครศรีธรรมราช)", wikiEn: "Wat Chedi (Nakhon Si Thammarat)" },
  { name: "วัดพระมหาธาตุวรมหาวิหาร", province: "นครศรีธรรมราช", deity: "พระบรมธาตุเจดีย์นครศรีธรรมราช", description: "พระบรมธาตุมรดกโลก ขอพรเรื่องความมั่นคง จิตใจ และปณิธานสำเร็จ", address: "ถนนราชดำเนิน ตำบลในเมือง อำเภอเมืองนครศรีธรรมราช", lat: 8.4110, lng: 99.9660, element: "earth", needs: ["จิตใจ", "การงาน"], worshipGuide: "ผ้าพระบฏ ดอกไม้ ธูปเทียน แห่ผ้าขึ้นธาตุในงานบุญ", wikiTh: "วัดพระมหาธาตุวรมหาวิหาร", wikiEn: "Wat Phra Mahathat Woramahawihan" },
  { name: "วัดช้างให้ (หลวงปู่ทวด)", province: "ปัตตานี", deity: "หลวงปู่ทวด เหยียบน้ำทะเลจืด", description: "ขอพรเรื่องแคล้วคลาดปลอดภัย สุขภาพ และเมตตามหานิยม", address: "ตำบลป่าไร่ อำเภอโคกโพธิ์", lat: 6.7936, lng: 101.0470, element: "water", needs: ["สุขภาพ", "จิตใจ", "การงาน"], worshipGuide: "ธูปเทียน ดอกไม้ ปิดทองรูปหลวงปู่ทวด ขอพรแคล้วคลาด", wikiTh: "วัดช้างให้ราษฎร์บูรณาราม", wikiEn: "Wat Chang Hai" },
  { name: "ศาลเจ้าแม่ลิ้มกอเหนี่ยว (ศาลเจ้าเล่งจูเกียง)", province: "ปัตตานี", deity: "เจ้าแม่ลิ้มกอเหนี่ยว", description: "ศาลเจ้าจีนศักดิ์สิทธิ์ ขอพรเรื่องค้าขาย โชคลาภ และความสำเร็จ", address: "ถนนอาเนาะรู ตำบลอาเนาะรู อำเภอเมืองปัตตานี", lat: 6.8686, lng: 101.2506, element: "metal", needs: ["โชคลาภ", "การงาน", "เงิน"], worshipGuide: "ธูปเทียน ผลไม้ ของไหว้จีน ลุยไฟในงานสมโภชประจำปี", wikiTh: "ศาลเจ้าเล่งจูเกียง", wikiEn: "Leng Chu Kiang Shrine" },
  { name: "วัดพระบรมธาตุไชยา", province: "สุราษฎร์ธานี", deity: "พระบรมธาตุไชยา", description: "ปูชนียสถานสมัยศรีวิชัย ขอพรเรื่องจิตใจมั่นคง ปัญญา และความสงบ", address: "ตำบลเวียง อำเภอไชยา", lat: 9.3861, lng: 99.1917, element: "earth", needs: ["จิตใจ"], worshipGuide: "ดอกไม้ ธูปเทียน เวียนประทักษิณรอบองค์พระธาตุ", wikiTh: "วัดพระบรมธาตุไชยาราชวรวิหาร", wikiEn: "Wat Phra Borommathat Chaiya" },
  { name: "วัดถ้ำเสือ", province: "กระบี่", deity: "รอยพระพุทธบาท บนยอดเขา", description: "ขอพรเรื่องความเพียร ปณิธานสำเร็จ และจิตใจเข้มแข็ง (บันได 1,237 ขั้น)", address: "ตำบลกระบี่น้อย อำเภอเมืองกระบี่", lat: 8.1272, lng: 98.9250, element: "earth", needs: ["จิตใจ", "การงาน"], worshipGuide: "ตั้งใจเดินขึ้นบันไดสู่ยอดเขา สักการะรอยพระพุทธบาทด้วยดอกไม้ธูปเทียน", wikiTh: "วัดถ้ำเสือ (จังหวัดกระบี่)", wikiEn: "Wat Tham Suea (Krabi)" },
  { name: "วัดพระธาตุดอยตุง", province: "เชียงราย", deity: "พระธาตุดอยตุง", description: "พระธาตุประจำปีเกิดปีกุน ขอพรเรื่องความสำเร็จ จิตใจ และชีวิตสูงส่ง", address: "ตำบลห้วยไคร้ อำเภอแม่ฟ้าหลวง", lat: 20.2953, lng: 99.8300, element: "earth", needs: ["จิตใจ", "การงาน"], worshipGuide: "ดอกไม้ ธูปเทียน ตุงบูชา เวียนรอบองค์พระธาตุคู่", wikiTh: "วัดพระธาตุดอยตุง", wikiEn: "Wat Phra That Doi Tung" },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ดึงภาพนำบทความ Wikipedia — retry เมื่อโดน 429 (rate limit) พร้อม backoff. ตัด ?utm_source ออกให้ URL สะอาด.
async function leadImage(title: string, lang: "th" | "en"): Promise<string | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
        headers: { accept: "application/json", "user-agent": "MumateSacredMapSeed/1.0 (contact: mootech.co@gmail.com)" },
      });
      if (r.status === 429) { await sleep(2500 * (attempt + 1)); continue; }
      if (!r.ok) return null;
      const j = (await r.json()) as { originalimage?: { source?: string }; thumbnail?: { source?: string } };
      const raw = j.originalimage?.source ?? j.thumbnail?.source ?? null;
      const url = raw ? raw.split("?")[0] : null;
      return url && url.startsWith("http") && url.length <= 1000 ? url : null;
    } catch {
      await sleep(1500);
    }
  }
  return null;
}

async function main() {
  const existing = new Set((await listVerified()).map((l) => (l.name ?? "").trim()));
  let added = 0, withImg = 0, skipped = 0, failed = 0;
  for (const p of PLACES) {
    if (existing.has(p.name.trim())) { skipped++; console.log(`skip (exists): ${p.name}`); continue; }
    let img: string | null = null;
    if (p.wikiTh) img = await leadImage(p.wikiTh, "th");
    if (!img && p.wikiEn) img = await leadImage(p.wikiEn, "en");
    const row = await createLocation(
      {
        name: p.name, deity: p.deity ?? null, description: p.description, province: p.province, address: p.address,
        lat: p.lat, lng: p.lng, element: p.element, needs: p.needs, worshipGuide: p.worshipGuide,
        imageUrl: img ?? "", googleMapUrl: "",
      },
      { status: "verified", source: "admin" },
    );
    if (row) { added++; if (img) withImg++; console.log(`+ ${p.name} ${img ? "[img]" : "[no img]"}`); }
    else { failed++; console.log(`FAILED: ${p.name}`); }
    await sleep(1300); // สุภาพกับ Wikipedia API (กัน 429)
  }
  console.log(`\ndone: added ${added}, withImage ${withImg}, skipped ${skipped}, failed ${failed}`);
  process.exit(0);
}

void main();

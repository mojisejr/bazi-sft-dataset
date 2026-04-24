import { EightChar, Lunar } from 'lunar-javascript';

// สร้างดวง 2018-12-08 17:13
const lunar = Lunar.fromDate(new Date('2018-12-08T17:13:00'));
const bazi = lunar.getEightChar();
const jia = "甲"; // ไม้กะ

// เช็คสถานะ 12 เชี่ยงแซ ตามหลักการคำนวณมาตรฐาน (ดาราศาสตร์จีน)
console.log("=== Orthodox 12 Qi Stages for 甲 (Jia) ===");
console.log("Year Branch:", bazi.getYearZhi(), "-> Stage:", bazi.getYearDiShi());
console.log("Month Branch:", bazi.getMonthZhi(), "-> Stage:", bazi.getMonthDiShi());
console.log("Day Branch:", bazi.getDayZhi(), "-> Stage:", bazi.getDayDiShi());
console.log("Hour Branch:", bazi.getTimeZhi(), "-> Stage:", bazi.getTimeDiShi());

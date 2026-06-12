import { PhoneNumberError, readPhoneNumber } from "@/lib/bazi/phone-number";

/**
 * POST /api/bazi/phone-reading
 * Body: { phoneNumber: string }
 * Returns: PhoneReading (closing pair, per-pair meanings, digit tally)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const phoneNumber = typeof body?.phoneNumber === "string" ? body.phoneNumber : "";

    if (!phoneNumber.trim()) {
      return Response.json({ error: "กรุณากรอกเบอร์มือถือ" }, { status: 400 });
    }

    const reading = readPhoneNumber(phoneNumber);
    return Response.json(reading, { status: 200 });
  } catch (error) {
    if (error instanceof PhoneNumberError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "อ่านเบอร์ไม่สำเร็จ";
    return Response.json({ error: message }, { status: 500 });
  }
}

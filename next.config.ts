import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
	turbopack: {
		root: projectRoot,
	},
	// compiled-knowledge.json (~42MB) อ่านด้วย fs ตอน runtime (ดู knowledge-loader.ts)
	// — แนบไฟล์ให้เฉพาะ route ที่ใช้จริง ไม่ให้บวมทุก function
	outputFileTracingIncludes: {
		"/api/bazi/rectify-hour/**": [
			"./src/lib/bazi/knowledge/compiled-knowledge.json",
		],
	},
	// อนุญาตให้เข้าถึง dev server ข้าม origin (เช่น ผ่าน ngrok) ไม่งั้น Next 15.3+/16
	// จะบล็อก HMR/dev runtime ทำให้ client ไม่ mount แล้วหน้าค้างว่าง.
	// ngrok free สุ่ม subdomain ใหม่ทุกรอบ → ใช้ wildcard ครอบไว้.
	allowedDevOrigins: [
		"unfrictional-lesley-unlimned.ngrok-free.dev",
		"*.ngrok-free.dev",
		"*.ngrok.io",
		"*.ngrok.app",
	],
};

export default nextConfig;
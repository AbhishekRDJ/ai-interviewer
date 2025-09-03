// import { NextResponse } from "next/server";
// import { v2 as cloudinary } from "cloudinary";

// // configure from env
// cloudinary.config({
//     cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
//     api_key: process.env.CLOUDINARY_API_KEY!,
//     api_secret: process.env.CLOUDINARY_API_SECRET!,
// });

// export async function POST(req: Request) {
//     try {
//         const formData = await req.formData();
//         const file = formData.get("file") as Blob;

//         if (!file) {
//             return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
//         }

//         // Convert Blob to Buffer
//         const buffer = Buffer.from(await file.arrayBuffer());

//         // Upload to Cloudinary
//         const uploadResult = await new Promise((resolve, reject) => {
//             cloudinary.uploader.upload_stream(
//                 { resource_type: "video", folder: "interview-recordings" },
//                 (error, result) => {
//                     if (error) reject(error);
//                     else resolve(result);
//                 }
//             ).end(buffer);
//         });

//         return NextResponse.json({ url: (uploadResult as any).secure_url });
//     } catch (err: any) {
//         return NextResponse.json({ error: err.message }, { status: 500 });
//     }
// }

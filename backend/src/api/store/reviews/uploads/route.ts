import path from "node:path";
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { uploadFilesWorkflow } from "@medusajs/medusa/core-flows";
import { MedusaError } from "@medusajs/framework/utils";

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) => {
  const input = req.files as Express.Multer.File[];

  if (!input?.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "No files were uploaded",
    );
  }

  const { result } = await uploadFilesWorkflow(req.scope).run({
    input: {
      files: input.map((f) => ({
        filename:
          path.basename(f.originalname).replace(/[^a-zA-Z0-9._-]/g, "_") ||
          "upload",
        mimeType: f.mimetype,
        content: f.buffer.toString("base64"),
        access: "public" as const,
      })),
    },
  });

  res.json({ files: result });
};

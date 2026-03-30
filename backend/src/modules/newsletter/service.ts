import { randomBytes } from "node:crypto";
import { MedusaService } from "@medusajs/framework/utils";
import { Subscriber } from "./models/subscriber";

class NewsletterModuleService extends MedusaService({
  Subscriber,
}) {
  generateUnsubscribeNonce(): string {
    return randomBytes(32).toString("base64url");
  }
}

export default NewsletterModuleService;

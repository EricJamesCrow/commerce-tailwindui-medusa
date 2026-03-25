import { MedusaService } from "@medusajs/framework/utils";
import { Subscriber } from "./models/subscriber";

class NewsletterModuleService extends MedusaService({
  Subscriber,
}) {}

export default NewsletterModuleService;

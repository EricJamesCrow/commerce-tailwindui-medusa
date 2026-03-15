import type { BodyProps } from "@react-email/components";
import { Body as EmailBody } from "@react-email/components";
import { cx } from "../utils/cx";

export const Body = (props: BodyProps) => {
    return (
        <EmailBody {...props} className={cx("m-0 bg-secondary p-0 font-body antialiased", props.className)}>
            {props.children}
        </EmailBody>
    );
};

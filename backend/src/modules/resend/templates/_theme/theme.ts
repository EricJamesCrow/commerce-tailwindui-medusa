import { getThemeColors } from "./theme-colors";

const rem = (px: number) => `${px}px`;

// Return type intentionally untyped — the Tailwind component casts via `as TailwindConfig`.
// Importing `Config` from tailwindcss causes CJS/ESM interop errors under Node16 module resolution.
export const getThemeObject = (theme: "light" | "dark" = "light") => ({
    ...getThemeColors(theme),
    screens: {
        xxs: "320px",
        // This must match the breakpoint in sonner: https://github.com/emilkowalski/sonner/blob/main/src/styles.css
        xs: "600px",
    },
    spacing: {
        px: rem(1),
        0: rem(0),
        0.5: rem(2),
        1: rem(4),
        1.5: rem(6),
        2: rem(8),
        2.5: rem(10),
        3: rem(12),
        3.5: rem(14),
        4: rem(16),
        4.5: rem(18),
        5: rem(20),
        5.5: rem(22),
        6: rem(24),
        7: rem(28),
        8: rem(32),
        8.5: rem(34),
        9: rem(36),
        9.5: rem(38),
        10: rem(40),
        10.5: rem(42),
        11: rem(44),
        11.5: rem(46),
        12: rem(48),
        13: rem(52),
        14: rem(56),
        16: rem(64),
        17: rem(68),
        18: rem(72),
        20: rem(80),
        24: rem(96),
        26: rem(104),
        28: rem(112),
        32: rem(128),
        48: rem(192),
        56: rem(224),
        64: rem(256),
        72: rem(288),
        80: rem(320),
        96: rem(384),
        120: rem(480),
        160: rem(640),
        180: rem(720),
        192: rem(768),
        256: rem(1024),
        320: rem(1280),
        360: rem(1440),
        400: rem(1600),
        480: rem(1920),
    },
    maxWidth: {
        container: "1280px",
    },
    width: {
        mobile: "375px",
    },
    fontSize: {
        xs: [rem(12), rem(18)],
        sm: [rem(14), rem(20)],
        md: [rem(16), rem(24)],
        lg: [rem(18), rem(28)],
        xl: [rem(20), rem(30)],
        "display-xs": [rem(24), rem(32)],
        "display-sm": [rem(30), rem(38)],
        "display-md": [
            rem(36),
            {
                lineHeight: rem(44),
                letterSpacing: "-0.72px",
            },
        ],
        "display-lg": [
            rem(48),
            {
                lineHeight: rem(60),
                letterSpacing: "-0.96px",
            },
        ],
        "display-xl": [
            rem(60),
            {
                lineHeight: rem(72),
                letterSpacing: "-1.2px",
            },
        ],
        "display-2xl": [
            rem(72),
            {
                lineHeight: rem(90),
                letterSpacing: "-1.44px",
            },
        ],
    },
    fontFamily: {
        body: [`Inter, -apple-system, "Segoe UI", system-ui, Roboto, Arial, sans-serif`],
        display: [`Inter, -apple-system, "Segoe UI", system-ui, Roboto, Arial, sans-serif`],
        mono: [`ui-monospace, "Roboto Mono", SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`],
    },
    textUnderlineOffset: {
        3: "3px",
    },
    borderRadius: {
        none: "0px",
        xs: "0.25rem",
        sm: "0.125rem",
        DEFAULT: "0.25rem",
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
        full: "9999px",
    },
    ringWidth: {
        3: "3px",
        6: "6px",
    },
    outlineWidth: {
        3: "3px",
        6: "6px",
    },
    ringOffsetWidth: {
        "-1": "-1px",
        "-2": "-2px",
        "-4": "-4px",
        "-8": "-8px",
    },
    transitionProperty: {
        inherit: "inherit",
    },

    boxShadow: () => {
        const shadows: Record<string, string> = {
            xs: "0px 1px 2px rgba(10, 13, 18, 0.05)",
            sm: "0px 1px 3px rgba(10, 13, 18, 0.10), 0px 1px 2px -1px rgba(10, 13, 18, 0.10)",
            md: "0px 4px 6px -1px  rgba(10, 13, 18, 0.10), 0px 2px 4px -2px  rgba(10, 13, 18, 0.06)",
            lg: "0px 12px 16px -4px  rgba(10, 13, 18, 0.08), 0px 4px 6px -2px  rgba(10, 13, 18, 0.03), 0px 2px 2px -1px  rgba(10, 13, 18, 0.04)",
            xl: "0px 20px 24px -4px  rgba(10, 13, 18, 0.08), 0px 8px 8px -4px  rgba(10, 13, 18, 0.03), 0px 3px 3px -1.5px  rgba(10, 13, 18, 0.04)",
            "2xl": "0px 24px 48px -12px  rgba(10, 13, 18, 0.18), 0px 4px 4px -2px  rgba(10, 13, 18, 0.04)",
            "3xl": "0px 32px 64px -12px  rgba(10, 13, 18, 0.14), 0px 5px 5px -2.5px  rgba(10, 13, 18, 0.04)",

            skeumorphic: "0px 0px 0px 1px rgba(10, 13, 18, 0.18) inset, 0px -2px 0px 0px rgba(10, 13, 18, 0.05) inset",

            "modern-mockup-inner-lg": "0px 0px 3.765px 1.255px rgba(10, 13, 18, 0.08) inset, 0px 0px 2.51px 1.255px rgba(10, 13, 18, 0.03) inset",
            "modern-mockup-inner-md": "0px 0px 1.692px 0.564px rgba(10, 13, 18, 0.08) inset, 0px 0px 1.128px 0.564px rgba(10, 13, 18, 0.03) inset",
            "modern-mockup-inner-sm": "0px 0px 4.48px 1.493px rgba(10, 13, 18, 0.08) inset, 0px 0px 2.987px 1.493px rgba(10, 13, 18, 0.03) inset",

            "modern-mockup-outer-lg":
                "0px 7.529px 10.039px -2.51px rgba(10, 13, 18, 0.08), 0px 2.51px 3.765px -1.255px rgba(10, 13, 18, 0.03), 0px 1.255px 1.255px -0.627px rgba(10, 13, 18, 0.04)",
            "modern-mockup-outer-md":
                "0px 3.385px 4.513px -1.128px rgba(10, 13, 18, 0.08), 0px 1.128px 1.692px -0.564px rgba(10, 13, 18, 0.03), 0px 0.564px 0.564px -0.282px  rgba(10, 13, 18, 0.04)",
        };

        shadows["xs-skeumorphic"] = `${shadows["skeumorphic"]}, ${shadows["xs"]}`;

        return shadows;
    },
    dropShadow: {
        "iphone-mockup": "20px 12px 18px rgba(16,24,40,0.2)",
    },
});

import { primitiveColors } from "./colors";

export const getThemeColors = (theme: "light" | "dark" = "light") => {
  const isLight = theme === "light";

  return {
    backgroundColor: {
      primary: isLight ? primitiveColors.white : primitiveColors["gray-900"],
      secondary: {
        DEFAULT: isLight ? primitiveColors["gray-50"] : primitiveColors["gray-800"],
      },
      "brand-solid": primitiveColors["brand-600"],
      "brand-secondary": primitiveColors["brand-100"],
      "error-secondary": primitiveColors["error-100"],
      "success-primary": primitiveColors["success-50"],
      "warning-primary": primitiveColors["warning-50"],
    },
    textColor: {
      primary: {
        DEFAULT: isLight ? primitiveColors["gray-900"] : primitiveColors["gray-50"],
      },
      secondary: isLight ? primitiveColors["gray-700"] : primitiveColors["gray-200"],
      tertiary: isLight ? primitiveColors["gray-600"] : primitiveColors["gray-300"],
      brand: {
        secondary: primitiveColors["brand-700"],
      },
      error: {
        primary: primitiveColors["error-600"],
      },
      warning: {
        primary: primitiveColors["warning-600"],
      },
      success: {
        primary: primitiveColors["success-600"],
      },
    },
    borderColor: {
      primary: {
        DEFAULT: isLight ? primitiveColors["gray-300"] : primitiveColors["gray-600"],
      },
      secondary: isLight ? primitiveColors["gray-200"] : primitiveColors["gray-700"],
      brand: {
        DEFAULT: primitiveColors["brand-500"],
      },
    },
    colors: {
      ...primitiveColors,
      button: {
        primary: {
          fg: primitiveColors.white,
          bg: primitiveColors["brand-600"],
        },
        secondary: {
          fg: isLight ? primitiveColors["gray-700"] : primitiveColors["gray-200"],
          bg: isLight ? primitiveColors.white : primitiveColors["gray-800"],
          border: isLight ? primitiveColors["gray-300"] : primitiveColors["gray-600"],
        },
      },
    },
  };
};

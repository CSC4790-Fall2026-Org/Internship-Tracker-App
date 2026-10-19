import type { ReactNode, SVGProps } from "react";

// One stroke icon set (24px grid, drawn at 16px by default) so every glyph shares weight and optical size.
export type IconProps = SVGProps<SVGSVGElement> & { size?: number };
export type IconComponent = (props: IconProps) => ReactNode;

function icon(paths: ReactNode) {
  return function Icon({ size = 16, strokeWidth = 1.75, className, ...rest }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        className={["shrink-0", className].filter(Boolean).join(" ")}
        {...rest}
      >
        {paths}
      </svg>
    );
  };
}

export const IconDashboard = icon(
  <>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </>,
);
export const IconBoard = icon(
  <>
    <rect x="3" y="3" width="18" height="18" rx="2.5" />
    <path d="M8 7.5v7M12 7.5v4M16 7.5v9" />
  </>,
);
export const IconList = icon(<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />);
export const IconCalendar = icon(
  <>
    <rect x="3" y="4.5" width="18" height="16.5" rx="2.5" />
    <path d="M16 2.5v4M8 2.5v4M3 10h18" />
  </>,
);
export const IconUsers = icon(
  <>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </>,
);
export const IconBriefcase = icon(
  <>
    <rect x="2.5" y="7" width="19" height="13.5" rx="2.5" />
    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M2.5 12.5h19" />
  </>,
);
export const IconProfile = icon(
  <>
    <circle cx="12" cy="12" r="9.5" />
    <circle cx="12" cy="10" r="3" />
    <path d="M7 19.2V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v.2" />
  </>,
);
export const IconSearch = icon(
  <>
    <circle cx="11" cy="11" r="7.5" />
    <path d="m20.5 20.5-4.2-4.2" />
  </>,
);
export const IconPlus = icon(<path d="M12 5v14M5 12h14" />);
export const IconX = icon(<path d="M18 6 6 18M6 6l12 12" />);
export const IconCheck = icon(<path d="M20 6 9 17l-5-5" />);
export const IconChevronRight = icon(<path d="m9 18 6-6-6-6" />);
export const IconChevronLeft = icon(<path d="m15 18-6-6 6-6" />);
export const IconChevronDown = icon(<path d="m6 9 6 6 6-6" />);
export const IconArrowUp = icon(<path d="M12 19V5M5 12l7-7 7 7" />);
export const IconArrowRight = icon(<path d="M5 12h14M12 5l7 7-7 7" />);
export const IconClock = icon(
  <>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M12 7v5l3 2" />
  </>,
);
export const IconMapPin = icon(
  <>
    <path d="M19.5 10c0 5.5-7.5 11.5-7.5 11.5S4.5 15.5 4.5 10a7.5 7.5 0 0 1 15 0Z" />
    <circle cx="12" cy="10" r="2.75" />
  </>,
);
export const IconBanknote = icon(
  <>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M6 12h.01M18 12h.01" />
  </>,
);
export const IconExternal = icon(<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />);
export const IconLink = icon(
  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />,
);
export const IconMail = icon(
  <>
    <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
    <path d="m21.5 7.5-8.47 5.4a1.94 1.94 0 0 1-2.06 0L2.5 7.5" />
  </>,
);
export const IconPhone = icon(
  <path d="M21.5 16.4v2.9a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 1.62 3.6 2 2 0 0 1 3.6 1.5h2.9a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.53 9.37a16 16 0 0 0 6 6l1.23-1.23a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7a2 2 0 0 1 1.72 2.01Z" />,
);
export const IconTrash = icon(<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8.5 6V4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />);
export const IconPencil = icon(<path d="M16.9 3.1a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Zm-2 2 4 4" />);
export const IconMore = icon(
  <>
    <circle cx="5" cy="12" r="1.1" fill="currentColor" />
    <circle cx="12" cy="12" r="1.1" fill="currentColor" />
    <circle cx="19" cy="12" r="1.1" fill="currentColor" />
  </>,
);
export const IconUpload = icon(<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />);
export const IconDownload = icon(<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />);
export const IconAlertTriangle = icon(
  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3ZM12 9v4M12 17h.01" />,
);
export const IconAlertCircle = icon(
  <>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M12 8v4.5M12 16h.01" />
  </>,
);
export const IconInfo = icon(
  <>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M12 16v-4.5M12 8h.01" />
  </>,
);
export const IconCheckCircle = icon(
  <>
    <circle cx="12" cy="12" r="9.5" />
    <path d="m8.5 12 2.5 2.5 4.5-5" />
  </>,
);
export const IconSparkles = icon(
  <path d="M12 3 10.1 8.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3ZM5 3v4M3 5h4M19 17v4M17 19h4" />,
);
export const IconFlag = icon(<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" />);
export const IconMessage = icon(<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />);
export const IconMenu = icon(<path d="M4 6h16M4 12h16M4 18h16" />);
export const IconLogOut = icon(<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />);
export const IconInbox = icon(
  <path d="M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />,
);
export const IconTrendingUp = icon(<path d="M22 7 13.5 15.5l-5-5L2 17M16 7h6v6" />);
export const IconBuilding = icon(
  <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18ZM6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2M10 6h4M10 10h4M10 14h4M10 18h4" />,
);
export const IconSend = icon(<path d="m22 2-7 20-4-9-9-4ZM22 2 11 13" />);
export const IconRefresh = icon(
  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5" />,
);
export const IconTaskSquare = icon(
  <>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="m8.5 12 2.5 2.5 4.5-5" />
  </>,
);
export const IconActivity = icon(<path d="M22 12h-4l-3 9L9 3l-3 9H2" />);
export const IconEye = icon(
  <>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </>,
);
export const IconEyeOff = icon(
  <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24M10.73 5.08A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.39-1.61M2 2l20 20" />,
);
export const IconFile = icon(<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5ZM14 2v6h6M8 13h8M8 17h5" />);
export const IconGraduation = icon(<path d="M22 10 12 5 2 10l10 5 10-5ZM6 12v5c3 3 9 3 12 0v-5M22 10v6" />);
export const IconUndo = icon(<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5" />);
export const IconCommand = icon(<path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />);
export const IconSidebar = icon(
  <>
    <rect x="3" y="3.5" width="18" height="17" rx="2.5" />
    <path d="M9 3.5v17" />
  </>,
);
export const IconTrophy = icon(<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4.5a2.5 2.5 0 0 0 2.5 5M17 6h2.5a2.5 2.5 0 0 1-2.5 5" />);
export const IconSun = icon(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </>,
);
export const IconMoon = icon(<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />);

import {
  FiActivity,
  FiBookOpen,
  FiClipboard,
  FiHome,
  FiTerminal,
  FiUser,
} from "react-icons/fi";

export const STUDENT_NAVIGATION = [
  {
    label: "Home",
    to: "/academy/dashboard",
    icon: FiHome,
    end: true,
    quickAccess: true,
  },
  {
    label: "Learn",
    to: "/academy/lessons",
    icon: FiBookOpen,
    quickAccess: true,
  },
  {
    label: "Practice",
    to: "/academy/practice",
    icon: FiTerminal,
    quickAccess: true,
  },
  {
    label: "Assignments",
    to: "/academy/assignments",
    icon: FiClipboard,
    quickAccess: true,
  },
  {
    label: "Progress",
    to: "/academy/progress",
    icon: FiActivity,
    quickAccess: true,
  },
  { label: "Profile", to: "/academy/profile", icon: FiUser },
];

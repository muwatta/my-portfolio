import { MotionConfig } from "framer-motion";

export default function PublicMotionConfig({ children }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

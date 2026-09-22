import { motion } from "framer-motion";
import { useInView } from "../../../hooks/useInView";
import { Container } from "../../../components/layout/Container";

export const ValueProposition = () => {
  const [ref, isInView] = useInView(0.2);

  return (
    <section className="always-dark py-16 md:py-24 border-y border-slate-800/50 bg-slate-900/30">
      <Container>
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="mb-12 max-w-3xl"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-400">
            Backend-first engineering
          </p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
            Production systems from backend to interface.
          </h2>
          <p className="mt-4 leading-relaxed text-slate-400">
            I build dependable backend systems and full-stack products: APIs,
            authentication, business workflows, data platforms, and responsive
            interfaces. My background in education strengthens how I understand
            users and explain complex systems.
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="grid md:grid-cols-3 gap-8 md:gap-12"
        >
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Software Engineering
            </h3>
            <p className="text-slate-400">
              Web applications, APIs, and backend platforms for education,
              business, and operational workflows.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Product Delivery
            </h3>
            <p className="text-slate-400">
              From architecture and APIs to frontend delivery, deployment, and
              ongoing maintenance.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Supporting Expertise
            </h3>
            <ul className="space-y-1">
              {[
                "Arduino, ESP32, and Raspberry Pi",
                "Sensors, actuators, and cameras",
                "Python, computer vision, and IoT",
              ].map((item) => (
                <li
                  key={item}
                  className="text-slate-400 text-sm flex items-center gap-2"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      </Container>
    </section>
  );
};

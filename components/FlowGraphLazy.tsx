"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

/** The diagram's library is 184 KiB of script. It loads when the section is within a screen of the viewport, not before. */
const FlowGraph = dynamic(() => import("@/components/FlowGraph"), {
  ssr: false,
  loading: () => <div className="rf-wrap rf-pending" aria-hidden="true" />,
});

export default function FlowGraphLazy() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "100% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  return <div ref={ref}>{near ? <FlowGraph /> : <div className="rf-wrap rf-pending" aria-hidden="true" />}</div>;
}

"use client";

import { useEffect, useRef, useState } from "react";
import "./login-motion.css";

const defaultPhrases = [
  "จัดการงานแจ้งซ่อม",
  "ติดตามงานช่าง",
  "ดูแลเครื่องจักร",
  "วางแผนงานบำรุงรักษา",
];

export function TypewriterText({
  phrases = defaultPhrases,
}: {
  phrases?: string[];
}) {
  const [text, setText] = useState("");
  const phraseKey = JSON.stringify(phrases.filter(Boolean));
  useEffect(() => {
    const words: string[] = JSON.parse(phraseKey);
    if (!words.length) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setTimeout> | undefined;
    let index = 0,
      position = 0,
      deleting = false;
    const segmenter = new Intl.Segmenter("th", { granularity: "grapheme" });
    const letters = words.map((word) =>
      Array.from(segmenter.segment(word), (item) => item.segment),
    );
    function tick() {
      if (reduced.matches) {
        setText(words[0]);
        return;
      }
      const current = letters[index];
      position += deleting ? -1 : 1;
      setText(current.slice(0, position).join(""));
      let delay = deleting ? 45 : 85;
      if (!deleting && position === current.length) {
        deleting = true;
        delay = 2100;
      } else if (deleting && position === 0) {
        deleting = false;
        index = (index + 1) % letters.length;
        delay = 300;
      }
      timer = setTimeout(tick, delay);
    }
    function start() {
      clearTimeout(timer);
      index = 0;
      position = 0;
      deleting = false;
      if (reduced.matches) setText(words[0]);
      else {
        setText("");
        timer = setTimeout(tick, 350);
      }
    }
    start();
    reduced.addEventListener("change", start);
    return () => {
      clearTimeout(timer);
      reduced.removeEventListener("change", start);
    };
  }, [phraseKey]);
  return (
    <em className="cmms-typewriter">
      <span className="motion-accessible">
        {phrases.filter(Boolean)[0] || ""}
      </span>
      <span aria-hidden="true">
        {text}
        <span className="cmms-caret" />
      </span>
    </em>
  );
}

type Dot = { x: number; y: number; vx: number; vy: number; radius: number };
export function ParticleBackground() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0,
      height = 0,
      frame = 0,
      previous = 0;
    let dots: Dot[] = [];
    function resize() {
      cancelAnimationFrame(frame);
      width = parent!.clientWidth;
      height = parent!.clientHeight;
      const scale = Math.min(devicePixelRatio || 1, 2);
      canvas!.width = Math.round(width * scale);
      canvas!.height = Math.round(height * scale);
      ctx!.setTransform(scale, 0, 0, scale, 0, 0);
      const count = Math.min(
        90,
        Math.max(28, Math.round((width * height) / 13000)),
      );
      dots = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 13,
        vy: (Math.random() - 0.5) * 13,
        radius: 0.7 + Math.random() * 1.2,
      }));
      previous = 0;
      if (width && height) {
        draw(0);
        if (!reduced.matches && !document.hidden)
          frame = requestAnimationFrame(animate);
      }
    }
    function draw(delta: number) {
      ctx!.clearRect(0, 0, width, height);
      for (const dot of dots) {
        dot.x += dot.vx * delta;
        dot.y += dot.vy * delta;
        if (dot.x < 0 || dot.x > width) dot.vx *= -1;
        if (dot.y < 0 || dot.y > height) dot.vy *= -1;
        dot.x = Math.max(0, Math.min(width, dot.x));
        dot.y = Math.max(0, Math.min(height, dot.y));
      }
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const a = dots[i],
            b = dots[j],
            distance = Math.hypot(a.x - b.x, a.y - b.y);
          if (distance < 115) {
            ctx!.strokeStyle = `rgba(167,243,208,${(1 - distance / 115) * 0.13})`;
            ctx!.lineWidth = 0.6;
            ctx!.beginPath();
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
            ctx!.stroke();
          }
        }
        ctx!.fillStyle = "rgba(209,250,229,.55)";
        ctx!.beginPath();
        ctx!.arc(dots[i].x, dots[i].y, dots[i].radius, 0, Math.PI * 2);
        ctx!.fill();
      }
    }
    function animate(time: number) {
      const delta = previous ? Math.min((time - previous) / 1000, 0.05) : 0;
      previous = time;
      draw(delta);
      frame = requestAnimationFrame(animate);
    }
    function visibility() {
      cancelAnimationFrame(frame);
      previous = 0;
      if (!document.hidden && width && height && !reduced.matches)
        frame = requestAnimationFrame(animate);
    }
    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    reduced.addEventListener("change", resize);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      reduced.removeEventListener("change", resize);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  return (
    <canvas className="cmms-particle-canvas" ref={ref} aria-hidden="true" />
  );
}

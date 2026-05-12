"use client";

import Image from "next/image";
import Link from "next/link";
import { Caladea, DM_Sans } from "next/font/google";
import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AnimatedOutlineButton } from "@/components/ui/AnimatedOutlineButton";
import { figmaEase } from "@/lib/figma-home-motion";

/** Figma Aeonik TRIAL — substitute with DM Sans 700 until licensed `.woff2` files are added under `public/fonts/`. */
const heroDisplaySans = DM_Sans({
  subsets: ["latin"],
  weight: ["700"],
  display: "swap",
});

const heroItalicSerif = Caladea({
  subsets: ["latin"],
  weight: ["700"],
  style: ["italic"],
  display: "swap",
});

const GLASS_COLS = 11;

export default function Hero() {
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <section
      id="home"
      className="relative w-full min-w-0 min-h-[min(100dvh,920px)] overflow-x-hidden overflow-y-visible bg-white py-12 pt-20 sm:py-16 sm:pt-24 lg:min-h-[900px] lg:py-20 lg:pt-28"
    >
      {/* Figma Frame 427319008 — soft panels (edge-to-edge) */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute inset-y-0 left-0 w-1/2 opacity-[0.92] lg:w-[46%]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/figma-assets/hero-bg-left.svg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-left"
          />
        </div>
        <div className="absolute inset-y-0 right-0 w-1/2 opacity-[0.92] lg:w-[46%]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/figma-assets/hero-bg-right.svg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-right"
          />
        </div>
        {/* Figma Group 1410085160 — frosted vertical strips (desktop) */}
        <div
          className="absolute inset-0 z-[1] hidden h-full w-full opacity-[0.88] lg:flex lg:divide-x-2 lg:divide-white/90"
          aria-hidden
        >
          {Array.from({ length: GLASS_COLS }).map((_, i) => (
            <div
              key={i}
              className="min-h-full min-w-0 flex-1 bg-[rgba(255,255,255,0.03)] backdrop-blur-[90px]"
            />
          ))}
        </div>
      </div>

      <div className="relative z-10 mx-auto w-full max-w-none px-4 sm:px-6 md:px-10 lg:px-12 xl:px-16 2xl:px-20">
        <div className="grid w-full items-center gap-12 lg:grid-cols-12 lg:gap-12 lg:pt-0">
          <div className="w-full max-w-[min(100%,680px)] lg:col-span-5">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: figmaEase }}
              className="inline-flex max-w-full items-center gap-3 rounded-full bg-gradient-to-r from-[#e8d3ff] to-[rgba(232,212,255,0.12)] py-1.5 pl-2 pr-5 sm:pr-6"
            >
              <span
                className="size-[22px] shrink-0 rounded-full shadow-md ring-1 ring-violet-300/70"
                style={{
                  background:
                    "radial-gradient(circle at 32% 28%, #f5f3ff 0%, #c4b5fd 38%, #6d28d9 100%)",
                }}
                aria-hidden
              />
              <span className="text-[17px] font-normal leading-snug tracking-tight text-[#1f006a] sm:text-[20px] lg:text-[24px] lg:leading-[29px]">
                Better Partnerships, Greater Growth.
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.06, ease: figmaEase }}
              className="mt-8 max-w-[660px] capitalize [font-size:clamp(2.25rem,5.5vw,97.75px)] [line-height:clamp(2.5rem,5.8vw,105px)] tracking-[0]"
            >
              <span className={`${heroDisplaySans.className} font-bold text-neutral-950`}>
                partner, track,
              </span>{" "}
              <span className={`${heroItalicSerif.className} font-bold italic text-[#4c1d95]`}>
                {"& grow with"}
              </span>{" "}
              <span className={`${heroDisplaySans.className} font-bold text-neutral-950`}>
                partnerships.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.12, ease: figmaEase }}
              className="mt-5 max-w-[586px] text-[18px] font-normal leading-relaxed text-neutral-600 sm:text-[20px] lg:text-[22px] lg:leading-8"
            >
              Connect with top publishers and brands. Build partnerships that grow revenue.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.18, ease: figmaEase }}
              className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center"
            >
              <Link
                href="/get-started"
                className="inline-flex items-center justify-center rounded-xl bg-[#1f006a] px-8 py-3.5 text-center text-sm font-semibold uppercase tracking-widest text-white transition-colors duration-200 hover:bg-[#2d0a7a]"
              >
                Get Started
              </Link>
              <AnimatedOutlineButton href="/contact">Contact</AnimatedOutlineButton>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.22, ease: figmaEase }}
            className={`relative lg:col-span-7 ${mounted && !reduceMotion ? "animate-hero-float" : ""}`}
          >
            <div className="relative mx-auto w-full max-w-[min(100%,640px)] lg:mx-0 lg:max-w-none">
              <div
                className="overflow-hidden rounded-[19px] border-[0.8px] border-white/80 shadow-[0_20px_52px_-14px_rgba(0,0,0,0.28)] ring-1 ring-black/[0.04]"
                style={{
                  background:
                    "linear-gradient(137.78deg, rgb(255, 255, 255) 9.74%, rgb(248, 243, 255) 100.34%)",
                }}
              >
                <Image
                  src="/figma-assets/hero-dashboard.png"
                  alt="LinkHexa dashboard — performance, commissions, and brands"
                  width={1121}
                  height={846}
                  className="h-auto w-full"
                  sizes="(max-width: 1024px) 100vw, 55vw"
                  priority
                  unoptimized
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

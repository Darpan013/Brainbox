import { useState } from 'react';
import { motion } from 'framer-motion';
import ParticleCanvas from './ParticleCanvas';

interface LandingPageProps {
    onEnter: () => void;
}

export default function LandingPage({ onEnter }: LandingPageProps) {
    const [hovered, setHovered] = useState(false);

    return (
        <motion.div
            className="relative h-screen w-screen bg-neutral-950 flex items-center justify-center overflow-hidden"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
        >
            {/* Particle Canvas — always mounted, fades in/out via CSS opacity */}
            <div
                style={{
                    opacity: hovered ? 1 : 0,
                    transition: 'opacity 1.5s ease-in-out',
                    position: 'absolute',
                    inset: 0,
                    zIndex: 0,
                    pointerEvents: 'none',
                }}
            >
                <ParticleCanvas />
            </div>

            {/* Subtle radial glow behind button */}
            <div
                className="absolute inset-0 pointer-events-none transition-opacity duration-700"
                style={{
                    opacity: hovered ? 1 : 0,
                    background:
                        'radial-gradient(ellipse 50% 40% at 50% 50%, rgba(59,130,246,0.06) 0%, transparent 70%)',
                    zIndex: 1,
                }}
            />

            {/* Center Content */}
            <div className="relative flex flex-col items-center gap-8" style={{ zIndex: 2 }}>
                {/* Logo / Title */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.1 }}
                    className="flex flex-col items-center gap-3"
                >
                    {/* Icon mark */}
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-pink-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path d="M10 3C8 3 5 5 5 8c0 2 1.5 3.5 3 4.5V15h4v-2.5C13.5 11.5 15 10 15 8c0-3-3-5-5-5z" fill="white" opacity="0.9" />
                            <rect x="7" y="15" width="6" height="1.5" rx="0.75" fill="white" opacity="0.6" />
                            <rect x="8" y="17" width="4" height="1" rx="0.5" fill="white" opacity="0.4" />
                        </svg>
                    </div>

                    <h1 className="text-neutral-100 font-semibold tracking-[0.25em] text-sm uppercase">
                        BrainBox
                    </h1>
                    <p className="text-neutral-600 text-xs tracking-widest uppercase">
                        Local AI · Private · Offline
                    </p>
                </motion.div>

                {/* CTA Button */}
                <motion.button
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.7, delay: 0.3 }}
                    onMouseEnter={() => setHovered(true)}
                    onMouseLeave={() => setHovered(false)}
                    onClick={onEnter}
                    className="group relative px-8 py-3 rounded-full border transition-all duration-300 cursor-pointer"
                    style={{
                        borderColor: hovered ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.1)',
                        backgroundColor: hovered ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.03)',
                        boxShadow: hovered
                            ? '0 0 28px rgba(59,130,246,0.2), 0 0 60px rgba(236,72,153,0.06)'
                            : 'none',
                    }}
                >
                    <span
                        className="font-normal tracking-[0.15em] text-sm uppercase transition-colors duration-300"
                        style={{ color: hovered ? '#93c5fd' : '#a3a3a3' }}
                    >
                        Start Thinking
                    </span>

                    {/* Arrow */}
                    <motion.span
                        className="ml-3 inline-block opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        animate={{ x: hovered ? 2 : 0 }}
                        style={{ color: '#60a5fa' }}
                    >
                        →
                    </motion.span>

                    {/* Button inner glow */}
                    <div
                        className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                        style={{
                            background:
                                'linear-gradient(135deg, rgba(59,130,246,0.05) 0%, rgba(236,72,153,0.05) 100%)',
                        }}
                    />
                </motion.button>

                {/* Version tag */}
                <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1, delay: 0.6 }}
                    className="text-neutral-800 text-xs tracking-widest"
                >
                    v0.1.0 alpha
                </motion.span>
            </div>
        </motion.div>
    );
}

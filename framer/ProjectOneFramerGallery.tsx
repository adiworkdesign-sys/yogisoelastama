import * as React from "react"
import { useEffect, useMemo, useState } from "react"
import { addPropertyControls, ControlType } from "framer"
import { AnimatePresence, motion } from "framer-motion"

type FramerImage = {
    src?: string
    srcSet?: string
    alt?: string
}

type Props = {
    images: FramerImage[]
    title: string
    role: string
    client: string
    year: string
    overview: string
    startOpen: boolean
    sidebarWidth: number
    gridHeight: number
    gap: number
    accent: string
    transition: any
}

const imageStyle = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center",
    display: "block",
    userSelect: "none",
    pointerEvents: "none",
} as const

function ArtImage({ image, alt }: { image?: FramerImage; alt: string }) {
    if (!image?.src) {
        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "grid",
                    placeItems: "center",
                    background: "#080808",
                    color: "rgba(255,255,255,0.42)",
                    fontSize: 12,
                    letterSpacing: 1.4,
                    textTransform: "uppercase",
                }}
            >
                Select Image
            </div>
        )
    }

    return (
        <img
            src={image.src}
            srcSet={image.srcSet}
            alt={image.alt || alt}
            style={imageStyle}
            draggable={false}
        />
    )
}

/**
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 */
export function ProjectOneFramerGallery(props: Props) {
    const {
        title,
        role,
        client,
        year,
        overview,
        startOpen,
        sidebarWidth,
        gridHeight,
        gap,
        accent,
        transition,
    } = props

    const images = useMemo(
        () => (Array.isArray(props.images) ? props.images.filter((image) => image?.src) : []),
        [props.images]
    )

    const [isGrid, setIsGrid] = useState(startOpen)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [direction, setDirection] = useState<1 | -1>(1)

    useEffect(() => {
        setIsGrid(startOpen)
    }, [startOpen])

    useEffect(() => {
        if (selectedIndex <= images.length - 1) return
        setSelectedIndex(0)
    }, [images.length, selectedIndex])

    useEffect(() => {
        ;[0, 1, 2].forEach((offset) => {
            const src = images[(selectedIndex + offset) % images.length]?.src
            if (!src) return
            const image = new Image()
            image.src = src
        })
    }, [images, selectedIndex])

    const total = Math.max(images.length, 1)
    const mainImage = images[selectedIndex]
    const detailA = images[(selectedIndex + 1) % total]
    const detailB = images[(selectedIndex + 2) % total]

    const selectImage = (nextIndex: number) => {
        if (nextIndex === selectedIndex) return
        setDirection(nextIndex > selectedIndex ? 1 : -1)
        setSelectedIndex(nextIndex)
    }

    const mediaVariants = {
        enter: (dir: 1 | -1) => ({
            opacity: 0,
            x: dir * 26,
            y: 10,
            scale: 1.035,
            filter: "blur(12px) brightness(1.08)",
        }),
        center: {
            opacity: 1,
            x: 0,
            y: 0,
            scale: 1,
            filter: "blur(0px) brightness(1)",
            transition,
        },
        exit: (dir: 1 | -1) => ({
            opacity: 0,
            x: dir * -18,
            y: -8,
            scale: 0.995,
            filter: "blur(10px) brightness(0.92)",
            transition: { duration: 0.32, ease: "easeInOut" },
        }),
    }

    return (
        <motion.div
            style={{
                width: "100%",
                height: "100%",
                minHeight: 420,
                display: "flex",
                overflow: "hidden",
                background: "#000",
                color: "#fff",
                fontFamily: "Inter, sans-serif",
            }}
        >
            <motion.div
                animate={{
                    width: isGrid ? `calc(100% - ${sidebarWidth}px)` : "100%",
                }}
                transition={transition}
                style={{
                    minWidth: 0,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    gap,
                    overflow: "hidden",
                }}
            >
                <motion.button
                    type="button"
                    onClick={() => setIsGrid(true)}
                    aria-label="Open project grid"
                    style={{
                        flex: "1 1 auto",
                        minHeight: 0,
                        border: 0,
                        padding: 0,
                        display: "grid",
                        position: "relative",
                        overflow: "hidden",
                        background: "#000",
                        cursor: isGrid ? "default" : "pointer",
                    }}
                >
                    <AnimatePresence initial={false} custom={direction} mode="popLayout">
                        <motion.div
                            key={`main-${selectedIndex}`}
                            custom={direction}
                            variants={mediaVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            style={{ gridArea: "1 / 1", width: "100%", height: "100%" }}
                        >
                            <ArtImage image={mainImage} alt={title} />
                        </motion.div>
                    </AnimatePresence>
                    {!isGrid && (
                        <div
                            style={{
                                position: "absolute",
                                inset: 0,
                                display: "grid",
                                placeItems: "center",
                                background:
                                    "linear-gradient(to top, rgba(0,0,0,0.56), rgba(0,0,0,0.05) 45%, rgba(0,0,0,0.56))",
                                pointerEvents: "none",
                            }}
                        >
                            <h1
                                style={{
                                    margin: 0,
                                    maxWidth: "80%",
                                    textAlign: "center",
                                    fontSize: "clamp(32px, 6vw, 76px)",
                                    lineHeight: 0.95,
                                    textTransform: "uppercase",
                                    letterSpacing: 4,
                                    fontWeight: 900,
                                }}
                            >
                                {title}
                            </h1>
                        </div>
                    )}
                </motion.button>

                <motion.div
                    animate={{ height: isGrid ? gridHeight : 0, opacity: isGrid ? 1 : 0 }}
                    transition={transition}
                    style={{
                        flex: "0 0 auto",
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap,
                        overflow: "hidden",
                    }}
                >
                    {[detailA, detailB].map((image, index) => (
                        <div key={`${selectedIndex}-${index}`} style={{ minWidth: 0, overflow: "hidden" }}>
                            <ArtImage image={image} alt={`${title} detail ${index + 1}`} />
                        </div>
                    ))}
                </motion.div>
            </motion.div>

            <motion.aside
                animate={{
                    width: isGrid ? sidebarWidth : 0,
                    opacity: isGrid ? 1 : 0,
                    x: isGrid ? 0 : 40,
                }}
                transition={transition}
                style={{
                    height: "100%",
                    boxSizing: "border-box",
                    overflow: "hidden",
                    background: "#070707",
                    borderLeft: `${gap}px solid #000`,
                    flexShrink: 0,
                }}
            >
                <div
                    style={{
                        width: sidebarWidth,
                        height: "100%",
                        boxSizing: "border-box",
                        padding: "clamp(28px, 4vw, 52px)",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                    }}
                >
                    <h2
                        style={{
                            margin: "0 0 28px",
                            fontSize: 30,
                            lineHeight: 1,
                            textTransform: "uppercase",
                            fontWeight: 850,
                        }}
                    >
                        {title}
                    </h2>

                    <div style={{ height: 1, background: "rgba(255,255,255,0.1)", marginBottom: 22 }} />

                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr 72px",
                            gap: "22px 24px",
                            marginBottom: 52,
                        }}
                    >
                        {[
                            ["Role", role],
                            ["Client", client],
                            ["Year", year],
                            ["Overview", overview],
                        ].map(([label, value]) => (
                            <div key={label} style={{ gridColumn: label === "Overview" ? "1 / -1" : undefined }}>
                                <div
                                    style={{
                                        marginBottom: 10,
                                        color: "rgba(255,255,255,0.45)",
                                        fontSize: 11,
                                        fontWeight: 750,
                                        textTransform: "uppercase",
                                        letterSpacing: 1.2,
                                    }}
                                >
                                    {label}
                                </div>
                                <div style={{ color: "#e8e8e8", fontSize: 15, lineHeight: 1.5, fontWeight: 620 }}>
                                    {value}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginBottom: 14,
                            }}
                        >
                            <span
                                style={{
                                    color: "rgba(255,255,255,0.48)",
                                    fontSize: 11,
                                    fontWeight: 800,
                                    letterSpacing: 2,
                                    textTransform: "uppercase",
                                }}
                            >
                                Image Select
                            </span>
                            <span
                                style={{
                                    color: "rgba(255,255,255,0.42)",
                                    fontFamily: "monospace",
                                    fontSize: 11,
                                    letterSpacing: 1.5,
                                }}
                            >
                                {String(selectedIndex + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
                            </span>
                        </div>

                        <div
                            style={{
                                display: "flex",
                                gap: 10,
                                overflowX: "auto",
                                padding: "4px 0 12px",
                                scrollbarWidth: "none",
                            }}
                        >
                            {images.map((image, index) => {
                                const selected = selectedIndex === index
                                return (
                                    <motion.button
                                        key={`${image.src}-${index}`}
                                        type="button"
                                        onClick={() => selectImage(index)}
                                        whileHover={{ opacity: 1, y: -1 }}
                                        whileTap={{ scale: 0.98 }}
                                        animate={{
                                            opacity: selected ? 1 : 0.58,
                                            y: selected ? -2 : 0,
                                            borderColor: selected ? accent : "rgba(255,255,255,0.12)",
                                        }}
                                        style={{
                                            width: 70,
                                            height: 70,
                                            flex: "0 0 auto",
                                            padding: 0,
                                            border: `1px solid ${selected ? accent : "rgba(255,255,255,0.12)"}`,
                                            background: "#111",
                                            cursor: "pointer",
                                            overflow: "hidden",
                                            position: "relative",
                                        }}
                                    >
                                        <ArtImage image={image} alt="" />
                                    </motion.button>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </motion.aside>
        </motion.div>
    )
}

ProjectOneFramerGallery.defaultProps = {
    images: [],
    title: "Leviathan RCG",
    role: "Concept Artist (Pre Production)",
    client: "Netflix / Blur Studio (via Axis Studios)",
    year: "2024",
    overview:
        "Concept design supporting high-end cinematic production, defining cohesive visual direction and production-ready assets for animation and FX.",
    startOpen: false,
    sidebarWidth: 420,
    gridHeight: 320,
    gap: 2,
    accent: "#ff6b00",
    transition: { type: "spring", stiffness: 145, damping: 24, mass: 0.92 },
}

addPropertyControls(ProjectOneFramerGallery, {
    images: {
        type: ControlType.Array,
        title: "Images",
        control: { type: ControlType.ResponsiveImage },
        maxCount: 10,
    },
    title: { type: ControlType.String, title: "Title" },
    role: { type: ControlType.String, title: "Role" },
    client: { type: ControlType.String, title: "Client" },
    year: { type: ControlType.String, title: "Year" },
    overview: { type: ControlType.String, title: "Overview", displayTextArea: true },
    startOpen: {
        type: ControlType.Boolean,
        title: "Start Open",
        enabledTitle: "Grid",
        disabledTitle: "Single",
    },
    sidebarWidth: {
        type: ControlType.Number,
        title: "Sidebar",
        min: 280,
        max: 560,
        step: 10,
        unit: "px",
    },
    gridHeight: {
        type: ControlType.Number,
        title: "Grid H",
        min: 160,
        max: 520,
        step: 10,
        unit: "px",
    },
    gap: {
        type: ControlType.Number,
        title: "Gap",
        min: 0,
        max: 12,
        step: 1,
        unit: "px",
    },
    accent: { type: ControlType.Color, title: "Accent" },
    transition: {
        type: ControlType.Transition,
        title: "Transition",
        defaultValue: { type: "spring", stiffness: 145, damping: 24, mass: 0.92 },
    },
})

export default ProjectOneFramerGallery

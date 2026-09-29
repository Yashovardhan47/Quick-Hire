from __future__ import annotations

import os
import subprocess
import tempfile
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFont, ImageOps

WIDTH, HEIGHT = 1280, 720
FPS = 24
SCENE_SECONDS = 4
SCENE_COUNT = 6

NARRATION_LINES = [
    "Find focused jobs and current opportunities in one place.",
    "See why each role matches your skills, with clear strengths and gaps.",
    "Match reasons connect to job related supporting proof.",
    "Turn missing requirements into a practical improvement plan.",
    "Recruiters review every applicant. People make every decision.",
    "AI assists. People decide. Protected traits stay out.",
]

NAVY = "#0b1530"
NAVY_2 = "#152a50"
MINT = "#18c7a6"
MINT_LIGHT = "#82edd9"
WHITE = "#f8fbff"
MUTED = "#aebbd2"
INK = "#172039"
PAPER = "#eef4f8"
AMBER = "#e5ae43"
BLUE = "#4f8bd7"

FONT_REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REGULAR, size)


def rounded(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], radius: int, fill: str, outline: str | None = None, width: int = 1) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def gradient(top: str, bottom: str) -> Image.Image:
    ramp = Image.linear_gradient("L").resize((WIDTH, HEIGHT))
    return ImageOps.colorize(ramp, top, bottom).convert("RGB")


def text(draw: ImageDraw.ImageDraw, xy: tuple[int, int], value: str, size: int, color: str, bold: bool = False, anchor: str | None = None) -> None:
    draw.text(xy, value, font=font(size, bold), fill=color, anchor=anchor)


def header(draw: ImageDraw.ImageDraw, chapter: str, number: int) -> None:
    rounded(draw, (54, 38, 94, 78), 11, MINT)
    text(draw, (74, 58), "Q", 22, NAVY, True, "mm")
    text(draw, (108, 47), "QuickHire", 23, WHITE, True)
    text(draw, (108, 72), "JOBS + RECRUITING", 10, MINT_LIGHT, True)
    rounded(draw, (1010, 44, 1224, 74), 15, "#1b3158", "#31527e")
    text(draw, (112, 112), chapter.upper(), 14, MINT_LIGHT, True)
    text(draw, (1117, 60), f"{number:02d} / {SCENE_COUNT:02d}", 13, WHITE, True, "mm")


def title_block(draw: ImageDraw.ImageDraw, title: str, subtitle: str) -> None:
    text(draw, (112, 150), title, 48, WHITE, True)
    text(draw, (112, 212), subtitle, 19, MUTED)


def scene_discover() -> Image.Image:
    image = gradient("#081127", "#163b4a")
    draw = ImageDraw.Draw(image)
    header(draw, "A job-only professional network", 1)
    title_block(draw, "Find jobs. Know why you match.", "Search QuickHire opportunities and current external listings without a content feed.")
    rounded(draw, (112, 270, 1168, 342), 18, WHITE)
    text(draw, (145, 306), "⌕", 30, "#64728a", True, "mm")
    text(draw, (178, 296), "Applied AI Engineer, Python, Bengaluru…", 19, "#67748b")
    rounded(draw, (962, 280, 1157, 332), 12, MINT)
    text(draw, (1059, 306), "Explore jobs", 16, NAVY, True, "mm")
    chips = ["AI & Data", "Engineering", "Healthcare", "Education", "Finance", "Operations"]
    x = 112
    for label in chips:
        width = 62 + len(label) * 8
        rounded(draw, (x, 370, x + width, 410), 20, "#172b4d", "#2d4a70")
        text(draw, (x + width // 2, 390), label, 13, WHITE, True, "mm")
        x += width + 12
    stats = [("40+", "current live listings"), ("3", "connected workspaces"), ("0", "biometric signals")]
    for index, (value, label) in enumerate(stats):
        x0 = 112 + index * 350
        rounded(draw, (x0, 454, x0 + 326, 600), 18, "#ffffff", "#dbe5ed")
        text(draw, (x0 + 24, 490), value, 44, "#087f6e", True)
        text(draw, (x0 + 24, 548), label, 16, "#47556e", True)
        text(draw, (x0 + 24, 574), "Focused on opportunity", 12, "#7c899e")
    return image


def scene_matches() -> Image.Image:
    image = gradient("#09132c", "#152e52")
    draw = ImageDraw.Draw(image)
    header(draw, "Clear job matches", 2)
    title_block(draw, "See why each job matches your profile.", "Every suggestion shows strengths, missing skills, and match reliability.")
    jobs = [
        ("AL", "Applied AI Engineer", "Aster Labs", 88, "MLOps"),
        ("NC", "Product Data Scientist", "Northstar Commerce", 81, "Experiment design"),
        ("OS", "Python Backend Developer", "OrbitStack", 84, "Docker"),
    ]
    for index, (mark, role, company, score, gap) in enumerate(jobs):
        x0 = 112 + index * 354
        rounded(draw, (x0, 278, x0 + 330, 596), 18, WHITE)
        rounded(draw, (x0 + 22, 300, x0 + 70, 348), 13, NAVY_2)
        text(draw, (x0 + 46, 324), mark, 13, WHITE, True, "mm")
        text(draw, (x0 + 86, 304), company.upper(), 10, "#718097", True)
        text(draw, (x0 + 22, 372), role, 19, INK, True)
        rounded(draw, (x0 + 22, 414, x0 + 308, 424), 5, "#dfe8ed")
        rounded(draw, (x0 + 22, 414, x0 + 22 + int(286 * score / 100), 424), 5, MINT)
        text(draw, (x0 + 22, 444), f"{score}% requirements match", 17, "#087f6e", True)
        text(draw, (x0 + 22, 475), "WHAT MATCHES", 10, "#718097", True)
        text(draw, (x0 + 22, 499), "Python · APIs · ML", 14, "#2d405c")
        text(draw, (x0 + 22, 533), "IMPROVE NEXT", 10, "#93620a", True)
        rounded(draw, (x0 + 22, 552, x0 + 160, 580), 8, "#fff0cd")
        text(draw, (x0 + 91, 566), gap, 11, "#8b5b07", True, "mm")
    return image


def scene_graph() -> Image.Image:
    image = gradient("#081127", "#123d49")
    draw = ImageDraw.Draw(image)
    header(draw, "Why you match", 3)
    title_block(draw, "See exactly what supports each skill.", "Resume, project, assessment, and typed-answer proof stay connected.")
    center = (640, 445)
    sources = [
        ((216, 326), "Resume", "FastAPI service"),
        ((216, 512), "Project", "Evidence API"),
        ((1006, 326), "Assessment", "89% verified"),
        ((1006, 512), "Typed interview", "System design"),
    ]
    for position, label, detail in sources:
        draw.line((position[0], position[1], center[0], center[1]), fill="#4f8b8d", width=3)
        rounded(draw, (position[0] - 120, position[1] - 52, position[0] + 120, position[1] + 52), 16, WHITE)
        text(draw, (position[0], position[1] - 12), label, 15, INK, True, "mm")
        text(draw, (position[0], position[1] + 18), detail, 12, "#6d7b91", False, "mm")
    rounded(draw, (center[0] - 128, center[1] - 86, center[0] + 128, center[1] + 86), 26, MINT)
    text(draw, (center[0], center[1] - 28), "PYTHON + APIs", 14, NAVY, True, "mm")
    text(draw, (center[0], center[1] + 15), "92", 42, NAVY, True, "mm")
    text(draw, (center[0], center[1] + 57), "supporting proof", 12, "#174a49", True, "mm")
    return image


def scene_roadmap() -> Image.Image:
    image = gradient("#09132c", "#193452")
    draw = ImageDraw.Draw(image)
    header(draw, "Skill improvement plan", 4)
    title_block(draw, "Turn missing skills into a practical next step.", "The plan prioritizes the smallest useful action that strengthens your match.")
    steps = [
        ("✓", "Verified", "Python + APIs", MINT, "Complete"),
        ("2", "Next · 12 min", "MLOps check", AMBER, "Stronger match"),
        ("3", "This week", "Deploy one model", BLUE, "Add project proof"),
        ("4", "Practice", "Typed interview", "#8897af", "Disclosed rubric"),
    ]
    line_y = 397
    draw.line((176, line_y, 1104, line_y), fill="#4a5e7b", width=5)
    for index, (number, kicker, label, color, note) in enumerate(steps):
        x = 176 + index * 309
        draw.ellipse((x - 28, line_y - 28, x + 28, line_y + 28), fill=color)
        text(draw, (x, line_y), number, 19, NAVY if index < 3 else WHITE, True, "mm")
        rounded(draw, (x - 128, 448, x + 128, 580), 16, WHITE)
        text(draw, (x - 106, 472), kicker.upper(), 10, "#738096", True)
        text(draw, (x - 106, 506), label, 17, INK, True)
        text(draw, (x - 106, 545), note, 12, "#087f6e" if index < 2 else "#68758a", True)
    return image


def scene_pipeline() -> Image.Image:
    image = gradient("#081127", "#17364e")
    draw = ImageDraw.Draw(image)
    header(draw, "Complete recruiter workspace", 5)
    title_block(draw, "Review every applicant. Keep decisions human-owned.", "All 12 candidates stay visible across review, verification, and decision stages.")
    columns = [("NEW & REVIEW", 4, "#e9f7f4"), ("VERIFICATION", 5, "#e8f0fb"), ("DECISION", 3, "#eef0f4")]
    for index, (label, count, color) in enumerate(columns):
        x0 = 112 + index * 354
        rounded(draw, (x0, 277, x0 + 330, 610), 18, "#f5f8fb")
        text(draw, (x0 + 20, 306), label, 11, "#5c6980", True)
        rounded(draw, (x0 + 274, 292, x0 + 310, 326), 17, NAVY_2)
        text(draw, (x0 + 292, 309), str(count), 13, WHITE, True, "mm")
        for row in range(count if count < 5 else 4):
            y = 345 + row * 61
            rounded(draw, (x0 + 16, y, x0 + 314, y + 50), 10, WHITE, "#dfe6ee")
            text(draw, (x0 + 30, y + 14), f"Candidate QH-{1842 + index * 1200 + row * 113}", 12, INK, True)
            text(draw, (x0 + 30, y + 36), f"{88 - index * 6 - row * 2}% match · recruiter review", 10, "#708097")
            draw.ellipse((x0 + 284, y + 17, x0 + 296, y + 29), fill=MINT if row < 2 else AMBER)
        if count > 4:
            text(draw, (x0 + 165, 594), "+1 more applicant", 11, "#627188", True, "mm")
    return image


def scene_trust() -> Image.Image:
    image = gradient("#071126", "#173d46")
    draw = ImageDraw.Draw(image)
    header(draw, "Safe and auditable AI", 6)
    title_block(draw, "AI explains. People decide.", "One trusted platform for candidates, recruiters, and governance teams.")
    cards: Iterable[tuple[str, str]] = [
        ("HUMAN CONFIRMATION", "Required for every stage change"),
        ("TYPED CONTENT ONLY", "No face, voice, accent, or emotion scoring"),
        ("PROTECTED SIGNALS BLOCKED", "Excluded at every ranking boundary"),
        ("REVIEWABLE EXPLANATIONS", "Supporting sources, reliability, and audit history"),
    ]
    for index, (label, detail) in enumerate(cards):
        col, row = index % 2, index // 2
        x0, y0 = 112 + col * 526, 282 + row * 126
        rounded(draw, (x0, y0, x0 + 500, y0 + 104), 16, WHITE)
        rounded(draw, (x0 + 18, y0 + 22, x0 + 72, y0 + 76), 16, "#e4f8f3")
        text(draw, (x0 + 45, y0 + 49), "✓", 24, "#087f6e", True, "mm")
        text(draw, (x0 + 92, y0 + 27), label, 12, "#087f6e", True)
        text(draw, (x0 + 92, y0 + 57), detail, 14, INK)
    rounded(draw, (112, 552, 1138, 616), 16, MINT)
    text(draw, (625, 584), "QUICKHIRE · AI JOB SEARCH + RECRUITER ASSISTANCE", 18, NAVY, True, "mm")
    return image


def add_timeline(frame: Image.Image, frame_number: int) -> Image.Image:
    result = frame.copy()
    draw = ImageDraw.Draw(result)
    total_frames = FPS * SCENE_SECONDS * SCENE_COUNT
    progress = frame_number / max(total_frames - 1, 1)
    rounded(draw, (54, 674, 1226, 682), 4, "#334664")
    rounded(draw, (54, 674, 54 + int(1172 * progress), 682), 4, MINT)
    elapsed = frame_number / FPS
    text(draw, (54, 655), f"00:{int(elapsed):02d}", 11, "#aebbd2", True)
    text(draw, (1226, 655), "00:24", 11, "#aebbd2", True, "ra")
    return result


def main() -> None:
    project = Path(__file__).resolve().parents[1]
    public = project / "public"
    public.mkdir(parents=True, exist_ok=True)
    output = public / "quickhire-overview.mp4"
    poster = public / "quickhire-overview-poster.jpg"

    scenes = [scene_discover(), scene_matches(), scene_graph(), scene_roadmap(), scene_pipeline(), scene_trust()]
    scenes[0].save(poster, quality=91, optimize=True)

    with tempfile.TemporaryDirectory(prefix="quickhire-overview-") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        silent_video = temp_dir / "visuals.mp4"
        command = [
            "ffmpeg", "-y", "-loglevel", "error",
            "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{WIDTH}x{HEIGHT}", "-r", str(FPS), "-i", "-",
            "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "22", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
            str(silent_video),
        ]
        process = subprocess.Popen(command, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
        assert process.stdin is not None
        total_frames = FPS * SCENE_SECONDS * SCENE_COUNT
        transition_frames = int(FPS * 0.55)
        for frame_number in range(total_frames):
            scene_index = min(frame_number // (FPS * SCENE_SECONDS), SCENE_COUNT - 1)
            within = frame_number % (FPS * SCENE_SECONDS)
            frame = scenes[scene_index]
            if within >= FPS * SCENE_SECONDS - transition_frames and scene_index < SCENE_COUNT - 1:
                alpha = (within - (FPS * SCENE_SECONDS - transition_frames)) / transition_frames
                frame = Image.blend(frame, scenes[scene_index + 1], alpha)
            framed = add_timeline(frame, frame_number)
            process.stdin.write(framed.tobytes())
        process.stdin.close()
        return_code = process.wait()
        if return_code != 0:
            error = process.stderr.read().decode("utf-8", errors="replace") if process.stderr else ""
            raise RuntimeError(f"ffmpeg video render failed: {error}")

        voice_files: list[Path] = []
        for index, line in enumerate(NARRATION_LINES):
            text_file = temp_dir / f"narration-{index}.txt"
            voice_file = temp_dir / f"narration-{index}.wav"
            text_file.write_text(line, encoding="utf-8")
            subprocess.run(
                [
                    "ffmpeg", "-y", "-loglevel", "error",
                    "-f", "lavfi", "-i", f"flite=textfile={text_file}:voice=slt",
                    "-af", "atempo=1.08,highpass=f=90,lowpass=f=10500,dynaudnorm=f=150:g=5",
                    "-ar", "48000", "-ac", "1", str(voice_file),
                ],
                check=True,
            )
            voice_files.append(voice_file)

        mux_command = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(silent_video)]
        for voice_file in voice_files:
            mux_command.extend(["-i", str(voice_file)])
        delayed = []
        filters = []
        for index in range(SCENE_COUNT):
            label = f"voice{index}"
            delay_ms = index * SCENE_SECONDS * 1000 + 120
            filters.append(f"[{index + 1}:a]adelay=delays={delay_ms}:all=1[{label}]")
            delayed.append(f"[{label}]")
        filters.append(
            "".join(delayed)
            + f"amix=inputs={SCENE_COUNT}:duration=longest:normalize=0,"
            "loudnorm=I=-17:TP=-2:LRA=7,apad=pad_dur=24,atrim=duration=24[narration]"
        )
        mux_command.extend(
            [
                "-filter_complex", ";".join(filters),
                "-map", "0:v:0", "-map", "[narration]",
                "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-ar", "48000",
                "-t", "24", "-movflags", "+faststart", str(output),
            ]
        )
        subprocess.run(mux_command, check=True)
    size_mb = os.path.getsize(output) / (1024 * 1024)
    print(f"created {output.name} ({size_mb:.2f} MB, 24 seconds, narrated)")


if __name__ == "__main__":
    main()

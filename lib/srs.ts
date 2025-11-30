// lib/srs.ts

// ===== Kiểu dữ liệu cho SM-2 =====

export type Sm2Grade = 0 | 1 | 2 | 3 | 4 | 5
// 0–2: quên
// 3: nhớ nhưng khó
// 4: nhớ ổn (Good)
// 5: rất dễ (Easy)

export interface Sm2State {
    repetitions: number   // số lần ôn thành công liên tiếp
    interval: number      // khoảng cách hiện tại (ngày)
    easiness: number      // hệ số dễ (EF), tối thiểu 1.3
    dueAt: Date           // lần tiếp theo nên ôn
}

// 4 mức rating giống Anki
export type ReviewRating = "again" | "hard" | "good" | "easy"

// Map 4 nút → grade SM-2
export function ratingToGrade(rating: ReviewRating): Sm2Grade {
    switch (rating) {
        case "again":
            return 1 // quên / lạ hoắc
        case "hard":
            return 3 // nhớ nhưng chật vật
        case "good":
            return 4 // nhớ ổn
        case "easy":
            return 5 // rất dễ
        default:
            return 1
    }
}

/**
 * Cập nhật trạng thái SM-2 sau khi user chấm điểm 1 thẻ.
 * @param prev  trạng thái trước đó (lấy từ DB)
 * @param grade Sm2Grade (0–5)
 * @param now   thời điểm hiện tại (mặc định new Date())
 */
export function applySm2(
    prev: Partial<Sm2State> | null,
    grade: Sm2Grade,
    now: Date = new Date()
): Sm2State {
    const MIN_EF = 1.3

    const prevReps = prev?.repetitions ?? 0
    const prevInterval = prev?.interval ?? 0
    const prevEf = prev?.easiness ?? 2.5

    let reps = prevReps
    let interval = prevInterval
    let ef = prevEf

    if (grade < 3) {
        // Again / fail → reset repetitions, interval ngắn
        reps = 0
        interval = 1
    } else {
        // Nhớ được
        if (reps === 0) {
            interval = 1
        } else if (reps === 1) {
            interval = 6
        } else {
            interval = Math.round(prevInterval * ef)
        }

        // Cập nhật EF theo công thức SM-2
        const diff = 5 - grade // grade thấp → diff cao → EF giảm
        ef =
            prevEf +
            (0.1 - diff * (0.08 + diff * 0.02))

        if (ef < MIN_EF) ef = MIN_EF
        reps = prevReps + 1
    }

    const dueAt = new Date(
        now.getTime() + interval * 24 * 60 * 60 * 1000
    )

    return {
        repetitions: reps,
        interval,
        easiness: ef,
        dueAt,
    }
}

import { Success } from "@atomist/automation-client";
import {
    AnyPush,
    CodeTransform,
    GoalProjectListenerEvent,
    GoalProjectListenerRegistration,
    PushTest,
    TransformResult,
    TransformReturnable,
} from "@atomist/sdm";

/**
 * Convert a CodeTransform to a GoalProjectListener
 * @param transform
 * @param name
 * @param pushTest
 */
export function transformToProjectListener(transform: CodeTransform,
                                           name: string,
                                           pushTest: PushTest = AnyPush): GoalProjectListenerRegistration {
    return {
        name,
        pushTest,
        events: [GoalProjectListenerEvent.before],
        listener: async (p, gi) => {
            try {
                const result = await transform(
                    p,
                    {
                        ...gi,
                    },
                    {});
                if (isTransformResult(result)) {
                    return {
                        code: result.success === true ? 0 : 1,
                    }
                }
            } catch (e) {
                return {
                    code: 1,
                    message: e.message,
                }
            }
            return Success;
        },
    };
}

function isTransformResult(tr: TransformReturnable): tr is TransformResult {
    const maybe = tr as TransformResult;
    return maybe && maybe.success !== undefined;
}

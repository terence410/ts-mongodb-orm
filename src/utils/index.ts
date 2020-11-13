import crypto from "crypto";

// region generic methods

/** @internal */
export function requireMongo() {
    try {
        require("mongodb");
    } catch (err) {
        throw new Error(`Please run "npm install --save mongodb @types/mongodb"`);
    }
}

/** @internal */
export function updateStack(stack: string, error: Error) {
    if (error.name) {
        return replaceFirstLine(stack, `${error.name}: ${error.message}`);

    } else {
        return replaceFirstLine(stack, error.message);
    }
}

/** @internal */
export function createMd5(value: string | Buffer): string {
    return crypto.createHash("md5").update(value).digest("hex");
}

/** @internal */
export function timeout(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/** @internal */
export function replaceFirstLine(paragraph: string, firstline: string): string {
    return paragraph.replace(/^.*/, firstline);
}

/** @internal */
export function generateRandomString(length: number) {
    const value = crypto.randomBytes(Math.ceil(length / 2)).toString("hex");
    return value.substr(0, length);
}

/** @internal */
export function getUsedMemoryInMb() {
    return (process.memoryUsage().heapUsed / 1024 / 1024) | 0;
}

// endregion


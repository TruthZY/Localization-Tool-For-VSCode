export class LocalizationEntry {
    constructor(
        public id: number,
        public text: string,
        public description: string,
        public filePath?: string,
        public line?: number
    ) {}
}

interface Label {
    show: boolean;
    stroke?: string;
    fill?: string;
}
interface Pixel {
    show: boolean;
    fill?: string;
}
interface LimitSize {
    minWidth?: number;
    minHeight?: number;
}
interface ActiveRect {
    stroke?: string;
    lineDash?: number[];
    lineDashOffset?: number;
    t?: any;
}
interface Rect {
    fill: string;
    stroke: string;
}
interface Dataset {
    index: number;
    active: boolean;
    coor: number[];
}
interface HitPoint {
    left?: number;
    top?: number;
    right?: number;
    bottom?: number;
}
declare class MarkImage {
    readonly el: string;
    readonly imageSrc: string;
    data: number[][];
    lock: boolean;
    label: Label;
    pixel: Pixel;
    limitSize: LimitSize;
    activeRect: ActiveRect;
    rect: Rect;
    onload: () => void;
    onselect: (n?: number, coor?: number[]) => void;
    onresult: (r?: number[][]) => void;
    onwarn: (w?: string) => void;
    datasets: Dataset[];
    image: HTMLImageElement;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    container: HTMLElement;
    WIDTH: number;
    HEIGHT: number;
    IMAGE_ORIGIN_WIDTH: number;
    IMAGE_ORIGIN_HEIGHT: number;
    IMAGE_WIDTH: number;
    IMAGE_HEIGHT: number;
    isFitting: boolean;
    scaleStep: number;
    pressType: number;
    originX: number;
    originY: number;
    hitPoint: HitPoint;
    ctrlRect: Dataset;
    remember: number[];
    constructor(options: object);
    get imageScale(): number;
    get selectedRect(): Dataset;
    get ctrlPoints(): number[][];
    initData(data: number[][]): Dataset[];
    merge(target: object, obj: object): void;
    deepCopy(arg: object): any;
    calcStep(init?: boolean): void;
    calcCtrls(coor: number[]): number[][];
    /**
     * 计算输出结果
     */
    calcData(): void;
    setEvent(): void;
    paintCtrls(coor: number[]): void;
    paintRectList(): void;
    /**
     * 绘制背景图片
     */
    paintImage(): void;
    /**
     * 绘制
     */
    draw(): void;
    /**
     * 适配背景图
     */
    fitZoom(): void;
    /**
     * 适配
     */
    fitting(): void;
    /**
     * 缩放
     * @param type true放大，false，缩小
     */
    setScale(type: boolean): void;
    center(): void;
    stayPosition(scale: number): void;
    clear(): void;
    zoomIn(): void;
    zoomOut(): void;
    remove(index: number): void;
}
export default MarkImage;

enum Cursor {
  "default",
  "nw-resize",
  "n-resize",
  "ne-resize",
  "e-resize",
  "se-resize",
  "s-resize",
  "sw-resize",
  "w-resize",
  "grab" = 10,
  "move",
  "crosshair",
}
interface Label {
  show: boolean
  stroke?: string
  fill?: string
}
interface Pixel {
  show: boolean
  fill?: string
}
interface LimitSize {
  minWidth?: number
  minHeight?: number
}
interface ActiveRect {
  stroke?: string
  lineDash?: number[]
  lineDashOffset?: number
  t?: any
}
interface Rect {
  fill: string
  stroke: string
}
interface Dataset {
  index: number
  active: boolean
  coor: number[]
}
interface HitPoint {
  left?: number
  top?: number
  right?: number
  bottom?: number
}

class MarkImage {
  readonly el: string = '';
  readonly imageSrc: string = '';
  data: number[][] = [];
  lock: boolean = false;
  label: Label = {
    show: true,
    stroke: '#000',
    fill: '#fac031'
  };

  pixel: Pixel = {
    show: true,
    fill: 'rgba(0,0,0,0.6)'
  };

  limitSize: LimitSize = {
    minWidth: 10,
    minHeight: 10
  };

  activeRect: ActiveRect = {
    stroke: '#67C23A',
    lineDash: [4, 2],
    lineDashOffset: 2
  };

  rect: Rect = {
    fill: 'rgba(247,200,4,0.2)',
    stroke: 'rgba(247,200,4,1)'
  };

  onload = () => { };
  onselect = (n?: number, coor?: number[]) => { };
  onresult = (r?: number[][]) => { };
  onwarn = (w?: string) => { };
  datasets: Dataset[] = [];
  image: HTMLImageElement = new Image();
  canvas: HTMLCanvasElement = document.createElement('canvas');
  ctx: CanvasRenderingContext2D;
  container: HTMLElement;
  WIDTH: number;
  HEIGHT: number;
  IMAGE_ORIGIN_WIDTH: number;
  IMAGE_ORIGIN_HEIGHT: number;
  IMAGE_WIDTH: number;
  IMAGE_HEIGHT: number;
  isFitting: boolean = true;
  scaleStep: number = 0; // 缩放步长
  pressType: number = 0; // 0,没有事件；1～8控制点拖拽，10，拖动图片；11，平移矩形，12，绘制矩形
  originX: number = 0;
  originY: number = 0;
  hitPoint: HitPoint;
  ctrlRect: Dataset;
  remember: number[] = [];
  constructor(options: object) {
    this.merge(this, options)
    this.datasets = this.initData(this.data)
    this.image = new Image()
    this.canvas = document.createElement('canvas')
    this.ctx = this.canvas.getContext('2d')
    this.container = document.querySelector(this.el)
    this.container.appendChild(this.canvas)
    this.WIDTH = this.canvas.width = this.container.clientWidth
    this.HEIGHT = this.canvas.height = this.container.clientHeight

    this.setEvent()
    this.image.src = this.imageSrc
  }

  get imageScale(): number {
    return this.IMAGE_HEIGHT / this.IMAGE_ORIGIN_HEIGHT
  }

  get selectedRect(): Dataset {
    return this.datasets.find(x => x.active)
  }

  get ctrlPoints(): number[][] {
    return this.selectedRect ? this.calcCtrls(this.selectedRect.coor) : []
  }

  initData(data: number[][]): Dataset[] {
    const d: number[][] = this.deepCopy(data)
    return d.map((coor: number[], index: number) => ({
      index,
      active: false,
      coor
    }))
  }

  merge(target: object, obj: object) {
    Object.keys(obj).forEach(p => {
      if (
        Object.prototype.toString.call(target[p]) === '[object Object]' &&
        Object.prototype.toString.call(obj[p]) === '[object Object]'
      ) {
        this.merge(target[p], obj[p])
      } else {
        target[p] = obj[p]
      }
    })
  }

  deepCopy(arg: object) {
    return JSON.parse(JSON.stringify(arg))
  }

  calcStep(init?: boolean) {
    if (init) {
      this.scaleStep = 100
      this.setScale(false)
    }
    if (this.IMAGE_WIDTH > this.WIDTH || this.IMAGE_HEIGHT > this.HEIGHT) {
      this.setScale(false)
      this.calcStep()
    }
  }

  calcCtrls(coor: number[]) {
    const [x1, y1, x2, y2] = coor
    return [
      [x1, y1],
      [(x2 - x1) / 2 + x1, y1],
      [x2, y1],
      [x2, (y2 - y1) / 2 + y1],
      [x2, y2],
      [(x2 - x1) / 2 + x1, y2],
      [x1, y2],
      [x1, (y2 - y1) / 2 + y1]
    ]
  }

  /**
   * 计算输出结果
   */
  calcData() {
    const list = this.deepCopy(this.datasets) as Dataset[]
    list.sort((a: Dataset, b: Dataset) => a.index - b.index)
    const newlist = list.map((x: Dataset): number[] =>
      x.coor.map((num: number) => Math.round(num))
    )
    this.data = newlist
    this.onresult(newlist)
  }

  // 设置监听事件
  setEvent() {
    this.image.addEventListener('load', () => {
      this.IMAGE_ORIGIN_WIDTH = this.IMAGE_WIDTH = this.image.width
      this.IMAGE_ORIGIN_HEIGHT = this.IMAGE_HEIGHT = this.image.height
      this.fitting()
      this.onload()
    })
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault()
    })
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.buttons === 1) {
        if (this.lock) return
        if (this.selectedRect) {
          // 点击控制点
          for (let i = 0; i < this.ctrlPoints.length; i++) {
            const point = this.ctrlPoints[i].map(x => x * this.imageScale)
            this.ctx.save()
            this.ctx.beginPath()
            this.ctx.fillStyle = 'red'
            this.ctx.arc(point[0] + this.originX, point[1] + this.originY, 5, 0, 2 * Math.PI)
            this.ctx.restore()
            const isHit = this.ctx.isPointInPath(e.offsetX, e.offsetY)
            if (isHit) {
              this.pressType = i + 1
              this.hitPoint = {
                left: e.offsetX - this.originX - point[0],
                top: e.offsetY - this.originY - point[1]
              }
              return
            }
          }
        }
        // 点击矩形
        if (Math.abs(this.remember[0] - e.offsetX) >= this.limitSize.minWidth &&
          Math.abs(this.remember[1] - e.offsetY) >= this.limitSize.minHeight
        ) {
          for (let m = 0; m < this.datasets.length; m++) {
            const item = this.datasets[m]
            const [x1, y1, x2, y2] = item.coor.map(x => x * this.imageScale)
            this.ctx.save()
            this.ctx.rect(x1 + this.originX, y1 + this.originY, x2 - x1, y2 - y1)
            this.ctx.restore()
            const isHit = this.ctx.isPointInPath(e.offsetX, e.offsetY)
            if (isHit) {
              this.datasets.forEach(val => val.active = false)
              item.active = true
              this.pressType = 11
              // 把选中的矩形移动到顶层
              this.datasets = this.datasets.filter(x => x !== item)
              this.datasets.push(item)
              this.hitPoint = {
                left: e.offsetX - this.originX - x1,
                top: e.offsetY - this.originY - y1,
                right: x2 - e.offsetX,
                bottom: y2 - e.offsetY
              }
              this.onselect(item.index, item.coor)
              return
            }
          }
        }

        // 点击空白区域
        const m = e.offsetX - this.originX
        const n = e.offsetY - this.originY
        if (m >= 0 &&
          m <= this.IMAGE_WIDTH &&
          n >= 0 &&
          n <= this.IMAGE_HEIGHT) {
          this.datasets.forEach((item) => (item.active = false))
          const x1 = (e.offsetX - this.originX) / this.imageScale
          const y1 = (e.offsetY - this.originY) / this.imageScale
          this.remember = [e.offsetX, e.offsetY]
          this.datasets.push({
            index: this.datasets.length,
            active: true,
            coor: [x1, y1, x1, y1]
          } as Dataset)
          this.pressType = 12
        }
      } else if (e.buttons === 2) {
        this.hitPoint = {
          left: e.offsetX - this.originX,
          top: e.offsetY - this.originY
        }
        this.pressType = 10
      }
    })
    this.canvas.addEventListener('mousemove', (e) => {
      const m = e.offsetX - this.originX
      const n = e.offsetY - this.originY
      if (m >= 0 &&
        m <= this.IMAGE_WIDTH &&
        n >= 0 &&
        n <= this.IMAGE_HEIGHT) {
        if (e.buttons === 1) {
          if (this.lock) return
          if (this.pressType === 12) {
            this.selectedRect.coor[2] = m / this.imageScale
            this.selectedRect.coor[3] = n / this.imageScale
          } else if (this.pressType === 11) {
            const x1 = e.offsetX - this.originX - this.hitPoint.left
            const y1 = e.offsetY - this.originY - this.hitPoint.top
            const x2 = e.offsetX + this.hitPoint.right
            const y2 = e.offsetY + this.hitPoint.bottom
            if (x1 >= 0 && x2 <= this.IMAGE_WIDTH && y1 >= 0 && y2 <= this.IMAGE_HEIGHT) {
              this.selectedRect.coor = [x1, y1, x2, y2].map(num => num / this.imageScale)
            }
          } else if (this.pressType >= 1 && this.pressType <= 8) {
            let newCoor: number[] = []
            const coor = this.selectedRect.coor
            const [X1, Y1, X2, Y2] = coor.map(x => x * this.imageScale) // 选中矩形的视图坐标
            const x1 = e.offsetX - this.originX - this.hitPoint.left // 相对origin原点坐标
            const y1 = e.offsetY - this.originY - this.hitPoint.top // 相对origin原点坐标
            switch (this.pressType) {
              case 1:
                if (x1 >= 0 && y1 >= 0 && y1 < Y2 - this.limitSize.minHeight) {
                  newCoor = [x1 / this.imageScale, y1 / this.imageScale, coor[2], coor[3]]
                }
                break
              case 2:
                if (y1 >= 0 && y1 < Y2) {
                  newCoor = [coor[0], y1 / this.imageScale, coor[2], coor[3]]
                }
                break
              case 3:
                if (x1 > X1 && x1 <= this.IMAGE_WIDTH && y1 >= 0 && y1 < Y2) {
                  newCoor = [coor[0], y1 / this.imageScale, x1 / this.imageScale, coor[3]]
                }
                break
              case 4:
                if (x1 > X1 && x1 <= this.IMAGE_WIDTH) {
                  newCoor = [coor[0], coor[1], x1 / this.imageScale, coor[3]]
                }
                break
              case 5:
                if (x1 > X1 && y1 > Y1 && x1 <= this.IMAGE_WIDTH && y1 <= this.IMAGE_HEIGHT) {
                  newCoor = [coor[0], coor[1], x1 / this.imageScale, y1 / this.imageScale]
                }
                break
              case 6:
                if (y1 > Y1 && y1 <= this.IMAGE_HEIGHT) {
                  newCoor = [coor[0], coor[1], coor[2], y1 / this.imageScale]
                }
                break
              case 7:
                if (x1 >= 0 && x1 < X2 && y1 > Y1 && y1 <= this.IMAGE_HEIGHT) {
                  newCoor = [x1 / this.imageScale, coor[1], coor[2], y1 / this.imageScale]
                }
                break
              case 8:
                if (x1 >= 0 && x1 < X2) {
                  newCoor = [x1 / this.imageScale, coor[1], coor[2], coor[3]]
                }
                break

              default:
                break
            }
            if (newCoor.length === 4 &&
              (newCoor[2] - newCoor[0]) >= this.limitSize.minWidth &&
              newCoor[3] - newCoor[1] >= this.limitSize.minHeight) {
              this.selectedRect.coor = newCoor
            } else {
              this.onwarn('尺寸超限')
            }
          }
          this.draw()
        } else if (e.buttons === 2) {
          this.originX = e.offsetX - this.hitPoint.left
          this.originY = e.offsetY - this.hitPoint.top
          this.draw()
        } else {
          // TODO 无操作改变鼠标样式
          if (this.selectedRect) {
            // 点击控制点
            for (let i = 0; i < this.ctrlPoints.length; i++) {
              const point = this.ctrlPoints[i].map(x => x * this.imageScale)
              this.ctx.save()
              this.ctx.beginPath()
              this.ctx.arc(point[0] + this.originX, point[1] + this.originY, 5, 0, 2 * Math.PI)
              this.ctx.restore()
              const isHit = this.ctx.isPointInPath(e.offsetX, e.offsetY)
              if (isHit) {
                this.container.style.cursor = Cursor[i + 1]
                return
              }
            }
          }
          // 点击矩形
          for (let m = 0; m < this.datasets.length; m++) {
            const item = this.datasets[m]
            const [x1, y1, x2, y2] = item.coor.map(x => x * this.imageScale)
            this.ctx.save()
            this.ctx.rect(x1 + this.originX, y1 + this.originY, x2 - x1, y2 - y1)
            this.ctx.restore()
            const isHit = this.ctx.isPointInPath(e.offsetX, e.offsetY)
            if (isHit) {
              this.container.style.cursor = Cursor[11]
              return
            }
          }
          // 点击空白区域
          const m = e.offsetX - this.originX
          const n = e.offsetY - this.originY
          if (m >= 0 &&
            m <= this.IMAGE_WIDTH &&
            n >= 0 &&
            n <= this.IMAGE_HEIGHT) {
            this.container.style.cursor = Cursor[12]
          }
        }
      }
      this.container.style.cursor = Cursor[this.pressType]
    })
    this.canvas.addEventListener('mouseup', () => {
      if (this.pressType === 12) {
        this.datasets.forEach((val) => {
          const [x1, y1, x2, y2] = val.coor
          val.coor = [
            Math.min(x1, x2),
            Math.min(y1, y2),
            Math.max(x1, x2),
            Math.max(y1, y2)
          ]
        })
        const coor = this.selectedRect.coor
        const w = coor[2] - coor[0]
        const h = coor[3] - coor[1]
        if (w < this.limitSize.minWidth) {
          this.onwarn('宽度不能小于' + this.limitSize.minWidth)
          this.remove(this.datasets.length - 1)
          this.datasets.forEach(x => x.active = false)
        } else if (h < this.limitSize.minHeight) {
          this.onwarn('高度度不能小于' + this.limitSize.minWidth)
          this.remove(this.datasets.length - 1)
          this.datasets.forEach(x => x.active = false)
        }
      }
      this.hitPoint = null
      this.pressType = 0
      this.calcData()
      this.container.style.cursor = Cursor[this.pressType]
      this.draw()
    })
    this.canvas.addEventListener('mousewheel', (e: WheelEvent) => {
      e.preventDefault()
      e.deltaY > 0 ? this.zoomOut() : this.zoomIn()
    })
    document.body.addEventListener('keyup', (e) => {
      if (this.selectedRect) {
        const [x1, y1, x2, y2] = this.selectedRect.coor
        switch (e.key) {
          case 'Backspace':// Backspace
            this.remove(this.selectedRect.index)
            break
          case 'ArrowLeft':
            if (x1 - 1 < 0) return
            this.selectedRect.coor = [x1 - 1, y1, x2 - 1, y2]
            this.draw()
            break
          case 'ArrowUp':
            if (y1 - 1 < 0) return
            this.selectedRect.coor = [x1, y1 - 1, x2, y2 - 1]
            this.draw()
            break
          case 'ArrowRight':
            if (x2 + 1 > this.IMAGE_ORIGIN_WIDTH) return
            this.selectedRect.coor = [x1 + 1, y1, x2 + 1, y2]
            this.draw()
            break
          case 'ArrowDown':
            if (y2 + 1 > this.IMAGE_ORIGIN_HEIGHT) return
            this.selectedRect.coor = [x1, y1 + 1, x2, y2 + 1]
            this.draw()
            break
          default:
            break
        }
        this.calcData()
      }
    })
  }

  // 绘制控制点
  paintCtrls(coor: number[]) {
    const list = coor.map((x: number) => x * this.imageScale)
    const ctrls = this.calcCtrls(list)
    this.ctx.fillStyle = '#fff'
    this.ctx.strokeStyle = '#f00'
    for (let n = 0; n < ctrls.length; n++) {
      const dot = ctrls[n]
      this.ctx.beginPath()
      this.ctx.arc(dot[0], dot[1], 3, 0, Math.PI * 2, true)
      this.ctx.fill()
      this.ctx.beginPath()
      this.ctx.arc(dot[0], dot[1], 3, 0, Math.PI * 2, true)
      this.ctx.stroke()
    }
  }

  // 绘制矩形列表
  paintRectList() {
    const { ctx, datasets, originX, originY } = this
    for (let i = 0; i < datasets.length; i++) {
      const coor = datasets[i].coor.map((x) => x * this.imageScale)
      ctx.save()
      ctx.translate(originX, originY)
      if (datasets[i].active) {
        ctx.strokeStyle = this.activeRect.stroke
        ctx.beginPath()
        ctx.lineDashOffset = this.activeRect.lineDashOffset
        ctx.setLineDash(this.activeRect.lineDash)
        ctx.moveTo(coor[0], coor[1])
        ctx.lineTo(coor[2], coor[1])
        ctx.lineTo(coor[2], coor[3])
        ctx.lineTo(coor[0], coor[3])
        ctx.lineTo(coor[0], coor[1])
        ctx.stroke()
        ctx.setLineDash([])
      } else {
        ctx.fillStyle = this.rect.fill
        ctx.fillRect(coor[0], coor[1], coor[2] - coor[0], coor[3] - coor[1])
        ctx.strokeStyle = this.rect.stroke
        ctx.strokeRect(coor[0], coor[1], coor[2] - coor[0], coor[3] - coor[1])
      }

      if (
        this.label.show &&
        (this.pressType !== 12 ||
          (this.pressType === 12 && i !== datasets.length - 1))
      ) {
        ctx.save()
        ctx.translate(coor[0], coor[1])
        ctx.fillStyle = this.label.fill
        ctx.fillRect(0, 0, 30, 14)
        ctx.fillStyle = this.label.stroke
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'center'
        ctx.fillText(datasets[i].index + 1 + '', 15, 7)
        ctx.restore()
      }
      if (datasets[i].active) {
        // 绘制控制点
        this.paintCtrls(datasets[i].coor)
        if (this.pixel.show) {
          ctx.save()
          const x1 = Math.min(coor[0], coor[2])
          const y1 = Math.min(coor[1], coor[3])
          ctx.translate(x1, y1)
          const [a1, b1, a2, b2] = datasets[i].coor
          const txt = `${Math.round(Math.abs(a2 - a1))}*${Math.round(
            Math.abs(b2 - b1)
          )}`
          ctx.fillStyle = this.pixel.fill
          ctx.fillRect(
            0,
            y1 + this.originY > 24 ? -24 : 0,
            ctx.measureText(txt).width + 4,
            20
          )
          ctx.fillStyle = '#fff'
          ctx.textBaseline = 'middle'
          ctx.textAlign = 'left'
          ctx.fillText(txt, 2, y1 + this.originY > 24 ? -15 : 10)
          ctx.restore()
        }
      }
      ctx.restore()
    }
  }

  /**
   * 绘制背景图片
   */
  paintImage() {
    this.ctx.drawImage(
      this.image,
      this.originX,
      this.originY,
      this.IMAGE_WIDTH,
      this.IMAGE_HEIGHT
    )
  }

  /**
   * 绘制
   */
  draw() {
    this.clear()
    this.paintImage()
    this.paintRectList()
    if (this.selectedRect) {
      clearInterval(this.activeRect.t)
      this.activeRect.t = setInterval(() => {
        let offset = this.activeRect.lineDashOffset
        this.activeRect.lineDashOffset = offset > 20 ? 0 : ++offset
        this.draw()
      }, 50)
    } else {
      clearInterval(this.activeRect.t)
    }
  }

  /**
   * 适配背景图
   */
  fitZoom() {
    if (this.IMAGE_HEIGHT / this.IMAGE_WIDTH >= this.HEIGHT / this.WIDTH) {
      this.IMAGE_WIDTH =
        this.IMAGE_ORIGIN_WIDTH / (this.IMAGE_ORIGIN_HEIGHT / this.HEIGHT)
      this.IMAGE_HEIGHT = this.HEIGHT
    } else {
      this.IMAGE_WIDTH = this.WIDTH
      this.IMAGE_HEIGHT =
        this.IMAGE_ORIGIN_HEIGHT / (this.IMAGE_ORIGIN_WIDTH / this.WIDTH)
    }
  }

  /**
   * 适配
   */
  fitting() {
    this.clear()
    this.fitZoom()
    this.center()
    this.paintImage()
    this.paintRectList()
    this.isFitting = true
  }

  /**
   * 缩放
   * @param type true放大，false，缩小
   */
  setScale(type: boolean) {
    type ? this.scaleStep++ : this.scaleStep--
    const abs = Math.abs(this.scaleStep)
    this.IMAGE_WIDTH =
      this.IMAGE_ORIGIN_WIDTH *
      Math.pow(this.scaleStep >= 0 ? 1.05 : 0.95, abs)
    this.IMAGE_HEIGHT =
      this.IMAGE_ORIGIN_HEIGHT *
      Math.pow(this.scaleStep >= 0 ? 1.05 : 0.95, abs)
  }

  center() {
    this.originX = (this.WIDTH - this.IMAGE_WIDTH) / 2
    this.originY = (this.HEIGHT - this.IMAGE_HEIGHT) / 2
  }

  stayPosition(scale: number) {
    this.originX = this.WIDTH / 2 - (this.WIDTH / 2 - this.originX) * scale
    this.originY = this.HEIGHT / 2 - (this.HEIGHT / 2 - this.originY) * scale
  }

  clear() {
    this.ctx.clearRect(0, 0, this.WIDTH, this.HEIGHT)
  }

  zoomIn() {
    const width = this.IMAGE_WIDTH
    if (this.isFitting) {
      this.calcStep(true)
      this.isFitting = false // 适配比例
    }
    this.clear()
    this.setScale(true)
    this.stayPosition(this.IMAGE_WIDTH / width)
    this.paintImage()
    this.paintRectList()
  }

  zoomOut() {
    const width = this.IMAGE_WIDTH
    if (this.isFitting) {
      this.calcStep(true)
      this.isFitting = false // 适配比例
    }
    this.clear()
    this.setScale(false)
    this.stayPosition(this.IMAGE_WIDTH / width)
    this.paintImage()
    this.paintRectList()
  }

  remove(index: number) {
    const num = parseInt(index + '')
    if (num < 0 || num > this.datasets.length - 1) return
    const list: Dataset[] = []
    this.datasets.forEach((dataset) => {
      if (dataset.index < num) {
        list.push(dataset)
      } else if (dataset.index > num) {
        dataset.index--
        list.push(dataset)
      }
    })
    this.datasets = list
    this.calcData()
    this.draw()
  }
}
export default MarkImage

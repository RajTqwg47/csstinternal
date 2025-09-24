/**
 * Improved QR Code Generator (byte mode only) with Reed-Solomon ECC and mask selection.
 * NOTE: This is a compact implementation for this project; not a full spec clone.
 */
class QRCodeGenerator {
    static generateQR(text, size = 300, eccLevel = 'M') {
        return new Promise((resolve, reject) => {
            try {
                const qr = new MiniQR(text, eccLevel);
                qr.build();
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const count = qr.size;
                canvas.width = size;
                canvas.height = size;
                const cell = size / count;
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0,0,size,size);
                ctx.fillStyle = '#000000';
                for (let r=0;r<count;r++) {
                    for (let c=0;c<count;c++) {
                        if (qr.modules[r][c]) {
                            const x = Math.round(c*cell);
                            const y = Math.round(r*cell);
                            const w = Math.ceil(cell);
                            const h = Math.ceil(cell);
                            ctx.fillRect(x,y,w,h);
                        }
                    }
                }
                resolve(canvas);
            } catch(e){
                reject(e);
            }
        });
    }
}

// Galois field 256 helpers for Reed-Solomon
class GF256 {
    static init() {
        if (this.exp) return;
        this.exp = new Array(512);
        this.log = new Array(256);
        let x = 1;
        for (let i=0;i<256;i++) {
            this.exp[i] = x;
            this.log[x] = i;
            x <<= 1;
            if (x & 0x100) x ^= 0x11d;
        }
        for (let i=256;i<512;i++) this.exp[i] = this.exp[i-256];
    }
    static mul(a,b){ if(a===0||b===0) return 0; return this.exp[(this.log[a]+this.log[b])%255]; }
    static pow(a,n){ if(n===0)return 1; if(a===0)return 0; return this.exp[(this.log[a]*n)%255]; }
    static inv(a){ return this.exp[255-this.log[a]]; }
}

// Simplified capacity table (approximate usable data bytes for ECC M, single block assumption)
// These are conservative to avoid overflow; real spec allows a bit more.
const VERSION_CAPACITY = [
    null,
    {dataBytes: 16,  ec: 10}, // 1
    {dataBytes: 28,  ec: 16}, // 2
    {dataBytes: 44,  ec: 26}, // 3
    {dataBytes: 64,  ec: 18}, // 4
    {dataBytes: 86,  ec: 24}, // 5
    {dataBytes: 108, ec: 28}, // 6
    {dataBytes: 124, ec: 36}, // 7
    {dataBytes: 154, ec: 42}, // 8
    {dataBytes: 182, ec: 48}, // 9
    {dataBytes: 216, ec: 56}, // 10
    {dataBytes: 254, ec: 68}, // 11
    {dataBytes: 290, ec: 80}, // 12
    {dataBytes: 334, ec: 96}, // 13
    {dataBytes: 365, ec: 104},// 14
    {dataBytes: 415, ec: 120},// 15
    {dataBytes: 453, ec: 132},// 16
    {dataBytes: 507, ec: 144},// 17
    {dataBytes: 563, ec: 168},// 18
    {dataBytes: 627, ec: 180},// 19
    {dataBytes: 669, ec: 196} // 20
];

class MiniQR {
    constructor(text, eccLevel='M') {
        this.text = text;
        this.eccLevel = eccLevel; // only 'M' used
        this.version = this.chooseVersion();
        this.size = 17 + 4 * this.version;
        this.modules = Array.from({length:this.size},()=>Array(this.size).fill(null));
        GF256.init();
    }
    chooseVersion(){
        const len = this.text.length;
        for(let v=1; v<VERSION_CAPACITY.length; v++) {
            // Overhead: mode (4 bits) + count (8 bits) ≈ 12 bits -> 2 bytes when padded
            // Conservative fit test
            if (len + 2 <= VERSION_CAPACITY[v].dataBytes) return v;
        }
        throw new Error('Payload too large (length '+len+'). Try reducing field sizes or splitting configuration.');
    }
    build(){
        this.placePatterns();
        const data = this.makeData();
        this.mapData(data);
        this.applyBestMask();
        this.addFormatInfo();
    }
    placePatterns(){
        // Finder patterns
        this.drawFinder(0,0);
        this.drawFinder(this.size-7,0);
        this.drawFinder(0,this.size-7);
        // Timing
        for(let i=8;i<this.size-8;i++){ this.modules[6][i]= (i%2===0); this.modules[i][6]=(i%2===0);}    
        // Dark module (version >=2) - simplified skip version info
    }
    drawFinder(x,y){
        for(let r=-1;r<=7;r++) for(let c=-1;c<=7;c++){
            const xx=x+c, yy=y+r; if(xx<0||yy<0||xx>=this.size||yy>=this.size) continue;
            if( (r>=0&&r<=6&&(c===0||c===6)) || (c>=0&&c<=6&&(r===0||r===6)) || (r>=2&&r<=4&&c>=2&&c<=4)) this.modules[yy][xx]=true; else this.modules[yy][xx]=false;
        }
    }
    makeData(){
        const cap = VERSION_CAPACITY[this.version];
        const bitBuffer = [];
        const len = this.text.length;
        // Mode 0100
        this.writeBits(bitBuffer, 0x4, 4);
        // Char count: for larger versions we can still use 8 bits until overflow (len limited by capacities)
        if (len > 255) throw new Error('Internal limit exceeded (count too large).');
        this.writeBits(bitBuffer, len, 8);
        // Data bytes
        for (let i=0;i<len;i++) {
            this.writeBits(bitBuffer, this.text.charCodeAt(i), 8);
        }
        // Terminator (up to 4 bits)
        const totalDataBits = cap.dataBytes * 8;
        const remaining = totalDataBits - bitBuffer.length;
        const terminatorBits = Math.min(4, Math.max(0, remaining));
        this.writeBits(bitBuffer, 0, terminatorBits);
        // Pad to whole bytes
        while(bitBuffer.length % 8) bitBuffer.push(0);
        // Convert to bytes
        const dataBytes = [];
        for(let i=0;i<bitBuffer.length;i+=8){
            let val=0; for(let b=0;b<8;b++) val = (val<<1)|bitBuffer[i+b]; dataBytes.push(val);
        }
        // Pad pattern
        let padToggle = true;
        while(dataBytes.length < cap.dataBytes) {
            dataBytes.push(padToggle ? 0xEC : 0x11);
            padToggle = !padToggle;
        }
        const ec = this.rsEncode(dataBytes, cap.ec);
        return dataBytes.concat(ec);
    }
    writeBits(arr,val,len){ for(let i=len-1;i>=0;i--) arr.push((val>>>i)&1); }
    rsEncode(data, ecLen){
        const poly = [1];
        for(let i=0;i<ecLen;i++){
            poly.push(0);
            for(let j=poly.length-1;j>0;j--) poly[j]=poly[j-1];
            poly[0]=0;
            for(let j=0;j<poly.length;j++) poly[j]=GF256.mul(poly[j],GF256.exp[i]);
            for(let j=1;j<poly.length;j++) poly[j]^=poly[j-1];
        }
        const ec = new Array(ecLen).fill(0);
        for(const d of data){
            const factor = d ^ ec[0];
            ec.shift(); ec.push(0);
            if(factor!==0){
                for(let i=0;i<poly.length;i++) ec[i]^=GF256.mul(poly[i],factor);
            }
        }
        return ec;
    }
    mapData(allBytes){
        let bitIndex=0; const totalBits = allBytes.length*8;
        let dir = -1; let row=this.size-1;
        for(let col=this.size-1; col>0; col-=2){ if(col===6) col--; for(;;){ for(let c=0;c<2;c++){ const cc=col-c; if(this.modules[row][cc]==null){ let dark=false; if(bitIndex<totalBits){ const b = allBytes[Math.floor(bitIndex/8)]; dark = ((b >>> (7-(bitIndex%8))) & 1)===1; } this.modules[row][cc]=dark; bitIndex++; } } row+=dir; if(row<0||row>=this.size){ row-=dir; dir=-dir; break;} } }
    }
    applyBestMask(){
        let bestScore=1e9,bestMask=0,bestModules=null;
        for(let mask=0;mask<4;mask++){ // limited mask set
            const clone=this.modules.map(r=>r.slice());
            for(let r=0;r<this.size;r++) for(let c=0;c<this.size;c++) if(this.isData(r,c)){ if(this.mask(mask,r,c)) clone[r][c]=!clone[r][c]; }
            const score=this.evaluate(clone);
            if(score<bestScore){ bestScore=score; bestMask=mask; bestModules=clone; }
        }
        this.modules=bestModules; this.chosenMask=bestMask;
    }
    isData(r,c){ // not finder or timing
        // finder areas
        if( (r<9&&c<9) || (r<9&&c>=this.size-8) || (r>=this.size-8&&c<9)) return false;
        if(r===6||c===6) return false;
        return true;
    }
    mask(mask,r,c){ switch(mask){case 0:return (r+c)%2===0;case 1:return r%2===0;case 2:return c%3===0;case 3:return (r+c)%3===0; default:return false;} }
    evaluate(m){ // very simplified penalty
        let score=0; const n=this.size;
        // adjacency rows
        for(let r=0;r<n;r++){ let run=1; for(let c=1;c<n;c++){ if(m[r][c]===m[r][c-1]){run++; if(run===5) score+=3; else if(run>5) score++; } else run=1; } }
        // adjacency cols
        for(let c=0;c<n;c++){ let run=1; for(let r=1;r<n;r++){ if(m[r][c]===m[r-1][c]){run++; if(run===5) score+=3; else if(run>5) score++; } else run=1; } }
        // balance
        let dark=0; for(let r=0;r<n;r++) for(let c=0;c<n;c++) if(m[r][c]) dark++;
        const ratio = Math.abs((dark*100/n/n)-50)/5; score += ratio*10;
        return score;
    }
    addFormatInfo(){
        // format bits: ECC M (00) + mask pattern
        const eccBits = 0b00; // for M
        const mask = this.chosenMask & 0b111;
        let format = (eccBits<<3)|mask; // 5 bits
        // BCH(15,5)
        let d = format<<10;
        const g=0b10100110111;
        while((d>>>10) !==0){ const shift=(d.toString(2).length-11); d ^= (g<<shift); }
        format = (format<<10)|d;
        format ^= 0b101010000010010; // mask
        // place
        for(let i=0;i<15;i++){
            const bit = (format>>i)&1;
            // vertical left
            if(i<6) this.modules[i][8]=bit===1; else if(i===6) this.modules[i+1][8]=bit===1; else if(i===7) this.modules[8][8]=bit===1; else this.modules[this.size-15+i][8]=bit===1;
            // horizontal top
            if(i<8) this.modules[8][this.size-1-i]=bit===1; else this.modules[8][15- i -1]=bit===1;
        }
        this.modules[this.size-8][8]=true; // fixed
    }
}

window.QRCodeGenerator = QRCodeGenerator;
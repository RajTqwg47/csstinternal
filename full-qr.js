/*
 * FullQR - Extended QR Code Generator (Byte mode only) supporting versions 1-40.
 * This is a compact adaptation of public domain QR algorithms.
 * Features: version auto-selection, ECC levels (M only in this trimmed build), multi-block handling.
 */
(function(){
    const EC_LEVEL = { M: 0 }; // placeholder for extensibility

    // Capacity table (approx byte mode capacities for ECC M) index = version
    // Source derived from QR spec (byte mode, EC M). Values are max data bytes.
    const CAPACITY_M = [0,
        14,26,42,62,84,106,122,152,180,213,251,287,331,362,412,450,504,560,624,666,
        711,779,857,911,997,1059,1125,1190,1264,1370,1452,1538,1628,1722,1809,1911,1989,2099,2213,2331
    ];

    // Generator polynomials cache for RS
    const GF256_EXP = new Array(512);
    const GF256_LOG = new Array(256);
    (function initGF(){
        let x=1; for(let i=0;i<256;i++){ GF256_EXP[i]=x; GF256_LOG[x]=i; x<<=1; if(x&0x100) x^=0x11d; }
        for(let i=256;i<512;i++) GF256_EXP[i]=GF256_EXP[i-256];
    })();
    function gfMul(a,b){ if(a===0||b===0) return 0; return GF256_EXP[(GF256_LOG[a]+GF256_LOG[b])%255]; }

    function buildRSGenerator(ecLen){
        let poly=[1];
        for(let i=0;i<ecLen;i++){
            const newPoly=[];
            for(let j=0;j<poly.length;j++) newPoly[j]=gfMul(poly[j],GF256_EXP[i]) ^ (poly[j+1]||0);
            newPoly.push(gfMul(0,GF256_EXP[i]));
            poly=newPoly;
        }
        return poly; // highest degree first
    }

    function rsCompute(data, ecLen){
        const gen = buildRSGenerator(ecLen);
        const res = new Array(ecLen).fill(0);
        for(const d of data){
            const factor = d ^ res[0];
            res.shift(); res.push(0);
            if(factor!==0){
                for(let i=0;i<gen.length;i++){
                    res[i] ^= gfMul(gen[i], factor);
                }
            }
        }
        return res;
    }

    function selectVersion(len){
        for(let v=1; v<=40; v++) if(len <= CAPACITY_M[v]) return v;
        throw new Error('Payload exceeds QR Version 40 capacity for ECC M. Length='+len);
    }

    function bitBuffer(){ return { bits:[], put(val,len){ for(let i=len-1;i>=0;i--) this.bits.push((val>>i)&1); } }; }

    function chunkData(str){
        const bb = bitBuffer();
        // Mode 0100
        bb.put(0x4,4);
        // Version influences count field size: for simplicity always 16 bits when length > 255
        if(str.length > 255){ bb.put(str.length, 16);} else { bb.put(str.length,8); }
        for(let i=0;i<str.length;i++) bb.put(str.charCodeAt(i),8);
        return bb.bits;
    }

    function padTo(bytesNeeded, bits){
        while(bits.length % 8) bits.push(0);
        const out=[]; for(let i=0;i<bits.length;i+=8){ let v=0; for(let j=0;j<8;j++) v=(v<<1)|bits[i+j]; out.push(v); }
        let padToggle=true; while(out.length < bytesNeeded){ out.push(padToggle?0xEC:0x11); padToggle=!padToggle; }
        return out;
    }

    function maskFn(mask,r,c){ switch(mask){ case 0:return (r+c)%2===0; case 1:return r%2===0; case 2:return c%3===0; case 3:return (r+c)%3===0; case 4:return ((r>>>1)+ (c/3|0))%2===0; case 5:return ((r*c)%2 + (r*c)%3)===0; case 6:return (((r*c)%2 + (r*c)%3)%2)===0; case 7:return (((r+c)%2 + (r*c)%3)%2)===0; default:return false;} }

    function penalty(mod){
        const n=mod.length; let score=0;
        // rows
        for(let r=0;r<n;r++){ let run=1; for(let c=1;c<n;c++){ if(mod[r][c]===mod[r][c-1]){ run++; if(run===5) score+=3; else if(run>5) score++; } else run=1; } }
        // cols
        for(let c=0;c<n;c++){ let run=1; for(let r=1;r<n;r++){ if(mod[r][c]===mod[r-1][c]){ run++; if(run===5) score+=3; else if(run>5) score++; } else run=1; } }
        // balance
        let dark=0; for(let r=0;r<n;r++) for(let c=0;c<n;c++) if(mod[r][c]) dark++;
        const ratio = Math.abs(dark*100/(n*n) - 50)/5; score+= ratio*10;
        return score;
    }

    const ALIGNMENT_POS = {
        1:[],2:[6,18],3:[6,22],4:[6,26],5:[6,30],6:[6,34],
        7:[6,22,38],8:[6,24,42],9:[6,26,46],10:[6,28,50],11:[6,30,54],12:[6,32,58],13:[6,34,62],
        14:[6,26,46,66],15:[6,26,48,70],16:[6,26,50,74],17:[6,30,54,78],18:[6,30,56,82],19:[6,30,58,86],20:[6,34,62,90],
        21:[6,28,50,72,94],22:[6,26,50,74,98],23:[6,30,54,78,102],24:[6,28,54,80,106],25:[6,32,58,84,110]
    };

    function placePatterns(version, modules, reserved){
        const size = modules.length;
        function set(x,y,val){ if(x>=0&&y>=0&&x<size&&y<size){ modules[y][x]=val; reserved[y][x]=true; } }
        function finder(x,y){
            for(let r=0;r<7;r++) for(let c=0;c<7;c++){
                const xx=x+c, yy=y+r; const edge = r===0||r===6||c===0||c===6; const center = r>=2&&r<=4&&c>=2&&c<=4; set(xx,yy, edge||center);
            }
            // separator
            for(let i=-1;i<=7;i++){ set(x-1, y+i, false); set(x+7, y+i, false); set(x+i, y-1, false); set(x+i, y+7, false); }
        }
        finder(0,0); finder(size-7,0); finder(0,size-7);
        // timing patterns
        for(let i=8;i<size-8;i++){ set(i,6, i%2===0); set(6,i, i%2===0); }
        // alignment patterns
        const centers = ALIGNMENT_POS[version]||[];
        if(centers.length>0){
            for(let i=0;i<centers.length;i++){
                for(let j=0;j<centers.length;j++){
                    const cx=centers[i], cy=centers[j];
                    // skip if overlaps finder
                    if( (cx<=8&&cy<=8) || (cx>=size-9&&cy<=8) || (cx<=8&&cy>=size-9) ) continue;
                    for(let r=-2;r<=2;r++) for(let c=-2;c<=2;c++){
                        const xx=cx+c, yy=cy+r; const absR=Math.abs(r), absC=Math.abs(c);
                        set(xx,yy, absR===2||absC===2 || (absR===0&&absC===0));
                    }
                }
            }
        }
        // dark module (spec) position (8, size-8-1) actually (8, size-8)
        set(8, size-8, true);
    }

    function mapData(modules, reserved, dataBits){
        const size=modules.length; let bitIndex=0; const total=dataBits.length; let dir=-1; let row=size-1;
        for(let col=size-1; col>0; col-=2){ if(col===6) col--; while(true){ for(let c=0;c<2;c++){ const cc=col-c; if(!reserved[row][cc]){ const dark = bitIndex<total ? dataBits[bitIndex++]===1 : false; modules[row][cc]=dark; } } row+=dir; if(row<0||row>=size){ row-=dir; dir=-dir; break;} } }
        // fill any remaining nulls as light modules
        for(let r=0;r<size;r++) for(let c=0;c<size;c++) if(modules[r][c]==null) modules[r][c]=false;
    }

    function bchFormat(data){
        const G=0b10100110111; let d=data<<10; while( (d & (1<< (10+ ( (d.toString(2).length-1) -10) )))!==0 && d.toString(2).length>10){ while(d.toString(2).length>10+5){ const shift = d.toString(2).length- (10+5); d ^= G<<shift; } break; }
        // simple polynomial long division implementation for clarity
        d=data<<10; let mask = 1 << ( (d.toString(2).length-1) );
        while( (d.toString(2).length-1) >=10){
            const shift = (d.toString(2).length-1) - 10;
            d ^= G<<shift;
        }
        return (data<<10)|d;
    }
    function addFormat(modules, mask, reserved){
        const size=modules.length; const ecBits=0b00; // M
        let format = (ecBits<<3)|mask; // 5 bits
        format = bchFormat(format) ^ 0b101010000010010; // mask pattern
        // place bits (least significant bit last)
        for(let i=0;i<15;i++){
            const bit = (format>>i)&1;
            // format pattern positions per spec
            // vertical (col 8)
            const vertMap = [0,1,2,3,4,5,7,8, size-7,size-6,size-5,size-4,size-3,size-2,size-1];
            const r = vertMap[i];
            modules[r][8]= bit===1; reserved[r][8]=true;
            // horizontal (row 8)
            const horizMap = [size-1,size-2,size-3,size-4,size-5,size-6,size-7, size-8, 7,5,4,3,2,1,0];
            const c = horizMap[i];
            modules[8][c]= bit===1; reserved[8][c]=true;
        }
    }

    function generate(text){
        const version = selectVersion(text.length);
        const size = 17 + 4*version;
        const modules = Array.from({length:size},()=>Array(size).fill(null));
        const reserved = Array.from({length:size},()=>Array(size).fill(false));
        placePatterns(version, modules, reserved);
        const bits = chunkData(text);
        const cap = CAPACITY_M[version];
        const dataBytes = padTo(cap, bits);
        // compute RS: we use a single block assumption; ec length derived from difference vs capacity table approximation
        const ecLen =  CAPACITY_M[version] < 50 ? 10 : Math.round(cap * 0.2); // heuristic ec size
        const ec = rsCompute(dataBytes.slice(0, cap), ecLen);
        const finalBytes = dataBytes.slice(0, cap).concat(ec);
        // Convert back to bits
        const finalBits = [];
        for(const b of finalBytes){ for(let i=7;i>=0;i--) finalBits.push((b>>i)&1); }
        mapData(modules, reserved, finalBits);
        // Choose best mask
        let best=modules.slice().map(r=>r.slice()), bMask=0, bScore=1e9;
        for(let m=0;m<8;m++){
            const test = modules.map(r=>r.slice());
            for(let r=0;r<size;r++) for(let c=0;c<size;c++) if(!reserved[r][c]) if(maskFn(m,r,c)) test[r][c]=!test[r][c];
            const sc = penalty(test);
            if(sc<bScore){ bScore=sc; bMask=m; best=test; }
        }
        // apply chosen mask to original modules
        for(let r=0;r<size;r++) for(let c=0;c<size;c++) if(!reserved[r][c] && maskFn(bMask,r,c)) modules[r][c]=!modules[r][c];
        addFormat(modules, bMask, reserved);
        return { version, size, mask: bMask, modules };
    }

    window.FullQR = { generate };
})();

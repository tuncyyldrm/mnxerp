import { NextResponse } from 'next/server';
import * as sql from 'mssql';
import { getDbConnection } from '@/app/lib/db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const tip = searchParams.get('tip');
    const anaGrup = searchParams.get('anaGrup');
    const kategori = searchParams.get('kategori');

    if (!tip) return NextResponse.json({ error: "Tip parametresi eksik" }, { status: 400 });

    try {
        const pool = await getDbConnection();
        const req = pool.request();
        let query = "";

        // Temel filtre: Boş olmayan ve null olmayan kayıtlar
        const baseFilter = "IS NOT NULL AND LTRIM(RTRIM({col})) <> ''";

        switch (tip) {
            case 'grubu':
                query = `SELECT DISTINCT grubu FROM [stok] WITH (NOLOCK) 
                         WHERE grubu ${baseFilter.replace('{col}', 'grubu')} 
                         ORDER BY grubu ASC`;
                break;

            case 'kategori':
                if (!anaGrup) return NextResponse.json([]);
                query = `SELECT DISTINCT kateGOri FROM [stok] WITH (NOLOCK) 
                         WHERE grubu = @anaGrup 
                         AND kateGOri ${baseFilter.replace('{col}', 'kateGOri')} 
                         ORDER BY kateGOri ASC`;
                req.input('anaGrup', sql.NVarChar, anaGrup);
                break;

            case 'tipi':
                if (!anaGrup || !kategori) return NextResponse.json([]);
                query = `SELECT DISTINCT tipi FROM [stok] WITH (NOLOCK) 
                         WHERE grubu = @anaGrup AND kateGOri = @kategori 
                         AND tipi ${baseFilter.replace('{col}', 'tipi')} 
                         ORDER BY tipi ASC`;
                req.input('anaGrup', sql.NVarChar, anaGrup);
                req.input('kategori', sql.NVarChar, kategori);
                break;

            default:
                return NextResponse.json([]);
        }

        const result = await req.query(query);
        
        // Sadece değerleri içeren bir diziye dönüştür (örn: ["KAPORTA", "MOTOR"])
        const data = result.recordset.map(row => Object.values(row)[0]);

        return NextResponse.json(data, {
            headers: {
                // Filtreler nadir değiştiği için uzun süreli cache (1 saat) mantıklı
                'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600'
            }
        });

    } catch (err: any) {
        console.error("Filtreleme Hatası:", err.message);
        return NextResponse.json({ error: "Filtreler çekilemedi" }, { status: 500 });
    }
}
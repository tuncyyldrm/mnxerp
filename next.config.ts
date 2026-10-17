import type { NextConfig } from "next";
import os from "os";

// Yerel ağdaki (Wi-Fi / Ethernet) IP'leri ve subnet'i dinamik olarak izin verilenlere ekle
const allowedOriginsSet = new Set<string>([
  'localhost',
  'localhost:3000',
  '127.0.0.1',
  '127.0.0.1:3000',
  '*.local',
  '*.local:3000',
]);

try {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' || (net.family as unknown) === 4) {
        allowedOriginsSet.add(net.address);
        allowedOriginsSet.add(`${net.address}:3000`);

        // Subnet'teki (örn: 192.168.1.x) tüm cihazları izin listesine ekle
        const parts = net.address.split('.');
        if (parts.length === 4 && (parts[0] === '192' || parts[0] === '10' || (parts[0] === '172' && Number(parts[1]) >= 16 && Number(parts[1]) <= 31))) {
          const prefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
          for (let i = 1; i <= 254; i++) {
            allowedOriginsSet.add(`${prefix}.${i}`);
            allowedOriginsSet.add(`${prefix}.${i}:3000`);
          }
        }
      }
    }
  }
} catch (e) {
  console.error('Yerel IP tespit hatası:', e);
}

// Özel belirtilen IP'ler
allowedOriginsSet.add('192.168.1.106');
allowedOriginsSet.add('192.168.1.106:3000');
allowedOriginsSet.add('192.168.1.61');
allowedOriginsSet.add('192.168.1.61:3000');

const nextConfig: NextConfig = {
  allowedDevOrigins: Array.from(allowedOriginsSet),
};

export default nextConfig;

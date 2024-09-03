const axios = require('axios');
const readline = require('readline');
const cheerio = require('cheerio'); // Untuk parsing HTML
const fs = require('fs'); // Modul untuk operasi file

// URL endpoint Telegram
const urlRequestPassword = 'https://my.telegram.org/auth/send_password';
const urlLogin = 'https://my.telegram.org/auth/login';
const urlCreateApp = 'https://my.telegram.org/apps/create';
const urlApps = 'https://my.telegram.org/apps';

// Konfigurasi permintaan
const config = {
  headers: {
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'Origin': 'https://my.telegram.org',
    'Referer': 'https://my.telegram.org/auth',
    'Sec-CH-UA': '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
    'Sec-CH-UA-Mobile': '?0',
    'Sec-CH-UA-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'X-Requested-With': 'XMLHttpRequest'
  }
};

// Fungsi untuk meminta nomor telepon dari pengguna
function askPhoneNumber() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Masukkan nomor telepon (misalnya +628xxx): ', (phone) => {
    // Validasi format nomor telepon jika diperlukan

    // Data yang akan dikirimkan dalam permintaan POST untuk meminta password
    const dataRequestPassword = new URLSearchParams();
    dataRequestPassword.append('phone', phone);

    sendPasswordRequest(phone, dataRequestPassword);
    rl.close();
  });
}

// Fungsi untuk mengirimkan permintaan POST untuk meminta password
async function sendPasswordRequest(phone, dataRequestPassword) {
  try {
    const response = await axios.post(urlRequestPassword, dataRequestPassword, config);
    //console.log('Response:', response.data);

    // Ambil random_hash dari response data
    const random_hash = response.data.random_hash; // Pastikan format response sesuai dengan yang diharapkan

    // Jika random_hash ada, lanjutkan untuk meminta password
    if (random_hash) {
      askPassword(phone, random_hash);
    } else {
      console.error('random_hash tidak ditemukan dalam respons.');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Fungsi untuk meminta password dari pengguna
function askPassword(phone, random_hash) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Masukkan password: ', async (password) => {
    // Data yang akan dikirimkan dalam permintaan POST untuk login
    const dataLogin = new URLSearchParams();
    dataLogin.append('phone', phone);
    dataLogin.append('random_hash', random_hash);
    dataLogin.append('password', password);

    try {
      const loginResponse = await axios.post(urlLogin, dataLogin, config);
      console.log('Login Response:', loginResponse.data);

      // Ambil stel_token dari cookie loginResponse untuk digunakan di permintaan berikutnya
      const stelToken = loginResponse.headers['set-cookie']
        .find(cookie => cookie.startsWith('stel_token'))
        .split(';')[0]
        .split('=')[1];

      // Jika stel_token ada, lanjutkan untuk membuat aplikasi
      if (stelToken) {
        fetchCreateAppHash(stelToken, phone);
      } else {
        console.error('stel_token tidak ditemukan dalam cookie.');
      }
    } catch (error) {
      console.error('Login Error:', error);
    }

    rl.close();
  });
}

// Fungsi untuk mendapatkan hash dari halaman /apps sebelum membuat aplikasi
async function fetchCreateAppHash(stelToken, phone) {
  // Konfigurasi permintaan GET untuk halaman /apps
  const appsConfig = {
    ...config,
    headers: {
      ...config.headers,
      'Cookie': `stel_token=${stelToken}`
    }
  };

  try {
    const appsResponse = await axios.get(urlApps, appsConfig);
    //console.log('Apps Page Response:', appsResponse.data);

    // Parsing HTML dengan cheerio
    const $ = cheerio.load(appsResponse.data);

    // Ambil hash dari HTML
    const hash = $('input[name="hash"]').val(); // Sesuaikan selector dengan struktur HTML
    if (hash) {
      createApp(stelToken, hash, phone);
    } else {
      console.error('hash tidak ditemukan dalam halaman /apps.');
    }
  } catch (error) {
    console.error('Fetch Create App Hash Error:', error);
  }
}

// Fungsi untuk membuat aplikasi baru
async function createApp(stelToken, hash, phone) {
  // Data yang akan dikirimkan dalam permintaan POST untuk membuat aplikasi
  const dataCreateApp = new URLSearchParams();
  dataCreateApp.append('hash', hash);
  dataCreateApp.append('app_title', 'wxbot1');
  dataCreateApp.append('app_shortname', 'wxshare1');
  dataCreateApp.append('app_url', '');
  dataCreateApp.append('app_platform', 'web');
  dataCreateApp.append('app_desc', '');

  // Tambahkan stel_token ke dalam header Cookie
  const createAppConfig = {
    ...config,
    headers: {
      ...config.headers,
      'Cookie': `stel_token=${stelToken}`
    }
  };

  try {
    const createAppResponse = await axios.post(urlCreateApp, dataCreateApp, createAppConfig);
    //console.log('Create App Response:', createAppResponse.data);

    // Setelah aplikasi dibuat, ambil informasi dari halaman /apps
    fetchAppInfo(stelToken, phone);
  } catch (error) {
    console.error('Create App Error:', error);
  }
}

// Fungsi untuk mengambil informasi aplikasi dari halaman /apps
async function fetchAppInfo(stelToken, phone) {
  // Konfigurasi permintaan GET untuk halaman /apps
  const appsConfig = {
    ...config,
    headers: {
      ...config.headers,
      'Cookie': `stel_token=${stelToken}`
    }
  };

  try {
    const appsResponse = await axios.get(urlApps, appsConfig);
   // console.log('Apps Page Response:', appsResponse.data);

    // Parsing HTML dengan cheerio
    const $ = cheerio.load(appsResponse.data);

    // Ambil api_id dan api_hash dari halaman
    const apiId = $('div.form-group').eq(0).find('strong').text().trim();
    const apiHash = $('div.form-group').eq(1).find('span').text().trim();

    console.log('API ID:', apiId);
    console.log('API Hash:', apiHash);

    // Simpan hasil ke file
    saveToFile(phone, apiId, apiHash);
  } catch (error) {
    console.error('Fetch App Info Error:', error);
  }
}

// Fungsi untuk menyimpan data ke file
function saveToFile(phone, apiId, apiHash) {
  const data = `${phone}|${apiId}|${apiHash}\n`;

  fs.appendFile('app.txt', data, (err) => {
    if (err) {
      console.error('Error writing to file:', err);
    } else {
      console.log('Data berhasil disimpan ke app.txt');
    }
  });
}

// Jalankan fungsi untuk meminta nomor telepon
askPhoneNumber();

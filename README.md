# IoT Teplotní Systém s Oboustrannou Komunikací (GPRS)
Tento projekt je komplexním řešením pro vzdálené monitorování teploty a
řízení koncových uzlů pomocí mobilní sítě (GPRS). Systém se skládá z
hardwarových měřicích uzlů (ESP32 + SIM800L), backend serveru v Node.js
(SQLite databáze) a klientského webového dashboardu v čistém (vanilla)
JavaScriptu a Chart.js.
## Hardwarové komponenty
Pro sestavení jednoho měřicího uzlu budete potřebovat následující
komponenty:
* **[Vývojová deska LILYGO TTGO T-Call (ESP32 + SIM800L)](https://www.laskakit.cz/lilygo-ttgo-t-call-v1-3-esp32-sim800l-wifi-gprs-modul/)** -
Integrovaná deska obsahující mikrokontrolér a GPRS modem.
* **[Teplotní senzor Dallas DS18B20](https://www.laskakit.cz/dallas-digitalni-vodotesne-cidlo-teploty-ds18b20-1m/)** - Přesný digitální teploměr (doporučujeme
voděodolnou variantu s kabelem).
* **[Rezistor 4.7 kΩ](https://www.gme.cz/v/1493088/gym-cym-rm-4k7-06w-1-0207-metalizovany-rezistor)** -
Nezbytný Pull-up rezistor pro datovou sběrnici 1-Wire.
* **SIM Karta** -
Jakákoliv SIM karta s aktivním datovým tarifem.
* *(Volitelně)* **Standardní signalizační LED dioda** (např. 5mm červená/
zelená) a **ochranný rezistor 220 Ω – 330 Ω**.
* *(Volitelně)* LiPo baterie (3.7V) s konektorem JST pro autonomní napájení.
---
## Instalace a zprovoznění do produkce
Následující kroky vás provedou instalací celého systému od hardwaru až po
serverové rozhraní z čistého stavu.
### Krok 1: Příprava hardwaru a konektivity
1. **Příprava SIM karty:** Vložte SIM kartu do běžného mobilního telefonu. V
nastavení zabezpečení telefonu **zrušte požadavek na zadávání kódu PIN**.
Zkontrolujte, zda fungují mobilní data. Následně kartu přesuňte do slotu na
desce TTGO T-Call.
2. **Zapojení komponent:**
* Zapojte datový pin senzoru DS18B20 do pinu `GPIO33` a nezapomeňte
přidat 4.7 kΩ pull-up rezistor mezi 3.3V a `GPIO33`.

<img width="300" height="280" alt="Screenshot From 2026-06-04 14-16-28" src="https://github.com/user-attachments/assets/500800b0-3b7f-4192-a541-66eae45a2734" />

* Pokud využíváte notifikační LED, zapojte její anodu na `GPIO13` a
katodu přes 220-330Ω rezistor do `GND`.
### Krok 2: Instalace Backend serveru
Pro běh serveru je vyžadováno prostředí Node.js.
1. Vytvořte složku pro projekt a vložte do ní serverové soubory. Poté se přesuňte do části se serverem.
```bash
cd backend
```
2. Otevřete terminál ve složce backend a nainstalujte závislosti:
```bash
npm install express sqlite3 cors
```
3. Spusťte server:
```bash
node index.js
```
*Při prvním spuštění se v adresáři automaticky vytvoří soubor databáze
`databaze.sqlite` se všemi potřebnými tabulkami. Server standardně naslouchá
na portu `8132`.*
### Krok 3: Konfigurace Frontendu (Dashboardu)
Frontend nevyžaduje instalaci žádného frameworku.
1. Otevřete soubor `frontend/index.html` v textovém editoru.
2. Najděte proměnnou definující IP adresu serveru (např. `IP_SERVERU`).
3. Změňte hodnotu z `localhost` na reálnou veřejnou IP adresu vašeho serveru
a ujistěte se, že port odpovídá (např. `8132`).
4. Nahrajte soubor `frontend/index.html` na váš webový hosting nebo jej otevřete
lokálně ve webovém prohlížeči.
### Krok 4: Konfigurace a Flashování ESP32 (ESPHome)
Firmware koncových uzlů je postaven na ESPHome.
1. Ujistěte se, že máte nainstalovaný [Python 3](https://www.python.org/downloads/) a ESPHome:
```bash
pip install esphome
```
2. Otevřete konfigurační soubor `esp.yaml`.
3. V bloku `sim800l.http_post` upravte URL adresu a formátovací řetězec:
* Nahraďte `<IP_ADRESS>` veřejnou IP adresou vašeho backend serveru.
* Nastavte jedinečné `device_id` (číslo, např. `1`, `2`) a `device_name`
(název stanoviště, např. `"Sklenik_01"`).
*Příklad úpravy lambda funkce:*
```yaml
body: !lambda |-
return str_sprintf("{\"device_id\": \"%d\", \"device_name\": \"%s\",
\"temperature\": %.1f}", 2, "SAGElab", id(temp).state);
```
4. Připojte vývojovou desku k počítači přes USB-C kabel.
5. Zkompilujte a nahrajte firmware:
```bash
esphome run esp.yaml
```
### Po úspěšném nahrání a restartu desky modul po 65 vteřinách naváže spojení se sítí GPRS a začne odesílat data na váš server.
---
## Dokumentace
Detailní uživatelskou a inženýrskou dokumentaci k celému systému (vysvětlení grafů, filtrování, struktury databáze a formátů REST API) naleznete v přiloženém souboru **Dokumentace_IoT_Systemu.pdf**.

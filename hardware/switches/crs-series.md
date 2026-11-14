---
title: "CRS-series"
slug: /crs-series
source: https://manual.mikrotik.com/hardware/crs-series
captured_at: '2026-11-04T09:45:44+08:00'
---

![](/img/7da2e3c29d053a0a.webp)

![](/img/ef6feece3b9368b4.webp)

:::info This article covers

- **CRS109-8G-1S-2HnD-IN**
- **CRS112-8G-4S-IN**
- **CRS210-8G-2S+IN**
- **CRS212-1G-10S-1S+IN**

:::

The CRS is a highly configurable switch, powered by RouterOS.

## First use

- Mount unit or place on the flat surface, please see paragraph for instructions.
- Choose your powering solution, please see the section for possibilities.
- The Initial connection has to be done via the Ethernet cable, using the MikroTik WinBox utility.
- Use WinBox to connect to the default IP address of 192.168.88.1 from any port, with the username admin and no password, the device is set up as a switch (or, for some models, check user and wireless passwords on the sticker).
- Update the device by clicking the "Check for updates" button to v6.46 or the latest RouterOS software to ensure the best performance and stability. The device needs to have an active internet connection.
- To manually update the device, go to our download page [https://mikrotik.com/download](https://mikrotik.com/download)
- Choose your architecture (MIPSBE) and download the latest packages from any channel to your PC.
- Open WinBox and upload packages in the Files menu.
- Reboot the device.
- Updating software will ensure the latest security fixes and regulations set by local law.
- Choose your Country.
- Set up your password to secure the device.

## Powering

The devices accept power in the following ways:

- direct-input power jack: 8-56V (24V 0.8A PSU included),
- passive PoE input: 8-56V (injector included). Except for CRS212-1G-10S-1+IN, which only accepts 8-30V direct input, with no PoE input support

## Extension slots and ports

- Except for CRS212: Eight (8) 10/100/1000 (Gigabit) Ethernet ports (Auto MDI/X).
- For CRS109: One SFP cage, compatible with 1.25G SFP modules, Built-in 802.11b/g/n 2GHz wirelessaccess point.
- For CRS112: Four SFP cages, compatible with 1.25G SFP modules.
- For CRS210: Two SFP+ cages, SFP+1 compatible with 1.25G and 10G, SFP+2 compatible 10G SFPmodules only.
- For CRS212: Ten SFP cages, one SFP+ cage, one Gigabit Ethernet port. The device is equipped with an RJ45 serial port, set by default to 115200bit/s, 8 data bits, 1 stop bit, no parity. Standard RJ45 to COM cable can be used, pinout can be found in the [Serial Console manual](/docs/management-tools/serial-console#rj45-type-serial-port)

## Configuration

Once logged in, we recommend clicking the “Check for updates” button in the QuickSet menu, as updating your RouterOS software to the latest version ensures the best performance and stability. For wireless models, please make sure you have selected the country where the device will be used, to conform with local regulations. RouterOS includes many configuration options in addition to what is described in this document. We suggest starting here to get yourself accustomed to the possibilities: [https://mt.lv/help](https://mt.lv/help) In case IP connection is not available, the WinBox tool ([https://mt.lv/winbox](https://mt.lv/winbox)) can be used to connect to the MAC address of the device from the LAN side (all access is blocked from the Internet port by default). For recovery purposes, it is possible to boot the device from the network, see a section Reset button.

## Default configuration

- CRS109-8G-1S-2HnD-IN: ports 2-8 are switched, wireless interface and switch are bridged, and bridgecontains a DHCP server. Eth1 and SFP1 have DHCP client configured.
- All other models all the ports are switched. Both models can be accessed through the IP 192.168.88.1, the username is admin and there is no password. Please connect with your web browser to this IP address to configure it. See this page for connection and configuration guides: [RouterOS documentation](/docs/introduction)

## Reset button

The reset button has three functions:

• Release the button when green LED starts flashing, to reset RouterOS configuration to defaults. • Release the button when the LED turns solid green to clear all configuration and defaults. • Release the button after LED is no longer lit (~20 seconds) to cause a device to look for Netinstall servers (required for reinstalling RouterOS over the network).

Regardless of the above option used, the system will load the backup RouterBOOT loader if the button is pressed before power is applied to the device. Useful for RouterBOOT debugging and recovery.

## Operating system support

The device supports RouterOS software with the version number at or above what is indicated in the RouterOS menu /system resource. Other operating systems have not been tested.

## Notice

- The Frequency band 5.470-5.725 GHz isn’t allowed for commercial use.
- In case WLAN devices work with different ranges than the above regulations, then a customized firmware version from the manufacturer/supplier is required to be applied to the end-user equipment and also prevent the end-user from reconfiguration.
- For Outdoor Usage: End-user requires approval/license from the NTRA.
- Datasheet for any device is available on the official manufacturer website.
- Products with the letters “EG” at the end of their serial number have their wireless frequency range limited to 2.400 – 2.4835 GHz, the TX power is limited to 20dBm (EIRP).
- Products with the letters “EG” at the end of their serial number have their wireless frequency range limited to 5.150 – 5.250 GHz, the TX power is limited to 23dBm (EIRP).
- Products with the letters “EG” at the end of their serial number have their wireless frequency range limited to 5.250 – 5.350 GHz, the TX power is limited to 20dBm (EIRP).

Please make sure the device has a lock package (firmware version from the manufacturer) which is required to be applied to the end-user equipment to prevent the end-user from reconfiguration. The product will be marked with country code “-EG”. This device needs to be upgraded to the latest version to ensure compliance with local authority regulations! It is the end users responsibility to follow local country regulations, including operation within legal frequency channels, output power, cabling requirements, and Dynamic Frequency Selection (DFS) requirements. All MikroTik radio devices must be professionally installed.

## Federal Communication Commission Interference Statement

FCC ID: TV7CRS109-8G2HND This equipment has been tested and found to comply with the limits for a Class B digital device, pursuant to Part 15 of the FCC Rules. These limits are designed to provide reasonable protection against harmful interference in a residential installation. This equipment generates, uses and can radiate radio frequency energy and, if not installed and used in accordance with the instructions, may cause harmful interference to radio communications. However, there is no guarantee that interference will not occur in a particular installation. If this equipment does cause harmful interference to radio or television reception, which can be determined by turning the equipment off and on, the user is encouraged to try to correct the interference by one of the following measures: • Reorient or relocate the receiving antenna. • Increase the separation between the equipment and receiver. • Connect the equipment into an outlet on a circuit different from that to which the receiver is connected. • Consult the dealer or an experienced radio/TV technician for help. FCC Caution: Any changes or modifications not expressly approved by the party responsible for compliance could void the user’s authority to operate this equipment. This device complies with Part 15 of the FCC Rules. Operation is subject to the following two conditions: (1) This device may not cause harmful interference, and (2) this device must accept any interference received, including interference that may cause undesired operation. This device and its antenna must not be co-located or operation in conjunction with any other antenna or transmitter. IMPORTANT: Exposure to Radio Frequency Radiation. This equipment complies with the FCC RF radiation exposure limits set forth for an uncontrolled environment. This equipment should be installed and operated with a minimum distance of 20 cm between the radiator and any part of your body.

## CE Declaration of Conformity

Manufacturer: MikroTikls SIA, Brivibas gatve 214i Riga, Latvia, LV1039.

<table><thead><tr><th>*BG*</th><th>С настоящото Mikrotīkls SIA декларира, че този тип радиосъоръжение RouterBOARD е в съответствие с Директива 2014/53/ЕС. Цялостният текст на ЕС декларацията за съответствие може да се намери на следния интернет адрес: [https://mikrotik.com/products](https://mikrotik.com/products)</th></tr></thead><tbody><tr><td>CS</td><td>Tímto Mikrotīkls SIA prohlašuje, že typ rádiového zařízení RouterBOARD je v souladu se směrnicí 2014/53/EU. Úplné znění EU prohlášení o shodě je k dispozici na této internetové adrese: [https://mikrotik.com/products](https://mikrotik.com/products)</td></tr><tr><td>DA</td><td>Hermed erklærer Mikrotīkls SIA , at radioudstyrstypen RouterBOARD er i overensstemmelse med direktiv 2014/53/EU. EU-overensstemmelseserklæringens fulde tekst kan findes på følgende internetadresse: [https://mikrotik.com/products](https://mikrotik.com/products)</td></tr><tr><td>DE</td><td>Hiermit erklärt Mikrotīkls SIA , dass der Funkanlagentyp RouterBOARD der Richtlinie 2014/53/EU entspricht. Der vollständige Text der EU-Konformitätserklärung ist unter der folgenden Internetadresse verfügbar: [https://mikrotik.com/products](https://mikrotik.com/products)</td></tr><tr><td>EL</td><td>Με την παρούσα ο/η Mikrotīkls SIA , δηλώνει ότι ο ραδιοεξοπλισμός RouterBOARD πληροί την οδηγία 2014/53/ΕΕ. Το πλήρες κείμενο της δήλωσης συμμόρφωσης ΕΕ διατίθεται στην ακόλουθη ιστοσελίδα στο διαδίκτυο: [https://mikrotik.com/products](https://mikrotik.com/products)</td></tr><tr><td>EN</td><td>Hereby, Mikrotīkls SIA declares that the radio equipment type RouterBOARD is in compliance with Directive 2014/53/EU. The full text of the EU declaration of conformity is available at the following internet address: [https://mikrotik.com/products](https://mikrotik.com/products)</td></tr><tr><td>ES</td><td>Por la presente, Mikrotīkls SIA declara que el tipo de equipo radioeléctrico RouterBOARD es conforme con la Directiva 2014/53/UE. El texto completo de la declaración UE de conformidad está disponible en la dirección Internet siguiente: [https://mikrotik.com/products](https://mikrotik.com/products)</td></tr><tr><td>ET</td><td>Käesolevaga deklareerib Mikrotīkls SIA , et käesolev raadioseadme tüüp RouterBOARD vastab direktiivi 2014/53/EL nõuetele. ELi vastavusdeklaratsiooni täielik tekst on kättesaadav järgmisel internetiaadressil: [https://mikrotik.com/products](https://mikrotik.com/products)</td></tr><tr><td>FI</td><td>Mikrotīkls SIA vakuuttaa, että radiolaitetyyppi RouterBOARD on direktiivin 2014/53/EU mukainen. EU-vaatimustenmukaisuusvakuutuksen täysimittainen teksti on saatavilla seuraavassa internetosoitteessa: [https://mikrotik.com/products](https://mikrotik.com/products)</td></tr><tr><td>FR</td><td>Le soussigné, Mikrotīkls SIA , déclare que l'équipement radioélectrique du type RouterBOARD est conforme à la directive 2014/53/UE. Le texte complet de la déclaration UE de conformité est disponible à l'adresse internet suivante: [https://mikrotik.com/products](https://mikrotik.com/products)</td></tr><tr><td>HR</td><td>Mikrotīkls SIA ovime izjavljuje da je radijska oprema tipa RouterBOARD u skladu s Direktivom 2014/53/EU. Cjeloviti tekst EU izjave o sukladnosti dostupan je na sljedećoj internetskoj adresi: [https://mikrotik.com/products](https://mikrotik.com/products)</td></tr><tr><td>HU</td><td>Mikrotīkls SIA igazolja, hogy a RouterBOARD típusú rádióberendezés megfelel a 2014/53/EU irányelvnek. Az EU-megfelelőségi nyilatkozat teljes szövege elérhető a következő internetes címen: [https://mikrotik.com/products](https://mikrotik.com/products)</td></tr><tr><td>IT</td><td>Il fabbricante, Mikrotīkls SIA , dichiara che il tipo di apparecchiatura radio RouterBOARD è conforme alla direttiva 2014/53/UE. Il testo completo della dichiarazione di conformità UE è disponibile al seguente indirizzo Internet: [https://mikrotik.com/products](https://mikrotik.com/products)</td></tr><tr><td>IS</td><td>Hér með lýsir Mikrotīkls SIA því yfir að RouterBOARD er í samræmi við grunnkröfur og aðrar kröfur, sem gerðar eru í tilskipun 2014/53/EU.Fullur texti ESB samræmisyfirlýsingar er að finna á eftirfarandi veffangi: [https://mikrotik.com/products](https://mikrotik.com/products)</td></tr><tr><td>LT</td><td>Aš, Mikrotīkls SIA , patvirtinu, kad radijo įrenginių tipas RouterBOARD atitinka Direktyvą 2014/53/ES. Visas ES atitikties deklaracijos tekstas prieinamas šiuo interneto adresu: [https://mikrotik.com/products](https://mikrotik.com/products)</td></tr><tr><td>LV</td><td>Ar šo Mikrotīkls SIA deklarē, ka radioiekārta RouterBOARD atbilst Direktīvai 2014/53/ES. Pilns ES atbilstības deklarācijas teksts ir pieejams šādā interneta vietnē: [https://mikrotik.com/products](https://mikrotik.com/products)</td></tr><tr><td>MT</td><td>B'dan, Mikrotīkls SIA , niddikjara li dan it-tip ta' tagħmir tar-radju RouterBOARD huwa konformi mad-Direttiva 2014/53/UE. It-test kollu tad-dikjarazzjoni ta' konformità tal-UE huwa disponibbli f'dan l-indirizz tal-Internet li ġej: [https://mikrotik.com/products](https://mikrotik.com/products)</td></tr><tr><td>NL</td><td>Hierbij verklaar ik, Mikrotīkls SIA , dat het type radioapparatuur RouterBOARD conform is met Richtlijn 2014/53/EU. De volledige tekst van de EU-conformiteitsverklaring kan worden geraadpleegd op het volgende internetadres: [https://mikrotik.com/products](https://mikrotik.com/products)</td></tr><tr><td>NO</td><td>Mikrotīkls SIA erklærer herved at utstyret RouterBOARD er i samsvar med de grunnleggende krav og øvrige relevante krav i direktiv 2014/53/EU. Den fulle teksten til EU-samsvarserklæringen er tilgjengelig på følgende internettadresse: [https://mikrotik.com/products](https://mikrotik.com/products)</td></tr><tr><td>PL</td><td>Mikrotīkls SIA niniejszym oświadcza, że typ urządzenia radiowego RouterBOARD jest zgodny z dyrektywą 2014/53/UE. Pełny tekst deklaracji zgodności UE jest dostępny pod następującym adresem internetowym: [https://mikrotik.com/products](https://mikrotik.com/products)</td></tr><tr><td>PT</td><td>O(a) abaixo assinado(a) Mikrotīkls SIA declara que o presente tipo de equipamento de rádio RouterBOARD está em conformidade com a Diretiva 2014/53/UE. O texto integral da declaração de conformidade está disponível no seguinte endereço de Internet: [https://mikrotik.com/products](https://mikrotik.com/products)</td></tr><tr><td>RO</td><td>Prin prezenta, Mikrotīkls SIA declară că tipul de echipamente radio RouterBOARD este în conformitate cu Directiva 2014/53/UE. Textul integral al declarației UE de conformitate este disponibil la următoarea adresă internet: [https://mikrotik.com/products](https://mikrotik.com/products)</td></tr><tr><td>SK</td><td>Mikrotīkls SIA týmto vyhlasuje, že rádiové zariadenie typu RouterBOARD je v súlade so smernicou 2014/53/EÚ. Úplné EÚ vyhlásenie o zhode je k dispozícii na tejto internetovej adrese: [https://mikrotik.com/products](https://mikrotik.com/products)</td></tr><tr><td>SL</td><td>Mikrotīkls SIA potrjuje, da je tip radijske opreme RouterBOARD skladen z Direktivo 2014/53/EU. Celotno besedilo izjave EU o skladnosti je na voljo na naslednjem spletnem naslovu: [https://mikrotik.com/products](https://mikrotik.com/products)</td></tr><tr><td>SV</td><td>Härmed försäkrar Mikrotīkls SIA att denna typ av radioutrustning RouterBOARD överensstämmer med direktiv 2014/53/EU. Den fullständiga texten till EU-försäkran om överensstämmelse finns på följande webbadress: [https://mikrotik.com/products](https://mikrotik.com/products)</td></tr></tbody></table>

![](/img/984ad54320693690.webp)

**BG. Инструкция**: Свържете адаптера на захранване, за да включите устройството. Отворете 192.168.88.1 в уеб браузър, за да настроите продукта. Повече информация в \{+\}[https://mt.lv/help-bg](https://mt.lv/help-bg)

**CS. Návod k použití**: Připojte napájecí adaptér k zapnutí přístroje. Otevřete 192.168.88.1 ve webovém prohlížeči pro konfiguraci produktu. Více informací najdete v \{+\}[https://mt.lv/help-cs](https://mt.lv/help-cs)

**DA. Instruktionsbog**: Tilslut strømadapteren for at tænde for enheden. Åbn 192.168.88.1 i en webbrowser til at konfigurere produktet. Mere information i \{+\}[https://mt.lv/help-da](https://mt.lv/help-da)

**DE. Bedienungsanleitung**: Verbinden Sie das Netzteil, um das Gerät einzuschalten. Öffnen Sie 192.168.88.1 in einem Web-Browser, um das Produkt zu konfigurieren. Weitere Informationen im \{+\}[https://mt.lv/help-de](https://mt.lv/help-de)

**EL. εγχειρίδιο οδηγιών**: Συνδέστε τον προσαρμογέα τροφοδοσίας για να ενεργοποιήσετε τη μονάδα. Ανοίξτε 192.168.88.1 σε ένα πρόγραμμα περιήγησης στο Web για να διαμορφώσετε το προϊόν. Περισσότερες πληροφορίες στο \{+\}[https://mt.lv/help-el](https://mt.lv/help-el)

**EN. Instruction manual**: Connect the power adapter to turn on the device. Open 192.168.88.1 in your web browser, to configure it. More information on \{+\}[https://mt.lv/help](https://mt.lv/help)

**ES. Manual de instrucciones**: Conecte el adaptador de alimentación para encender la unidad. Abra 192.168.88.1 en un navegador web para configurar el producto. Más información en \{+\}[https://mt.lv/help-es](https://mt.lv/help-es)

**ET. Kasutusjuhend**: Ühendage toiteadapter seadme sisselülitamiseks. Avatud 192.168.88.1 in veebilehitseja seadistada toodet. Rohkem teavet \{+\}[https://mt.lv/help-et](https://mt.lv/help-et)

**FI. Käyttöohje**: Kytke virtalähde päälle laitteen. Avaa 192.168.88.1 in selaimen määrittää tuotteen. Lisää tietoa \{+\}[https://mt.lv/help-fi](https://mt.lv/help-fi)

**FR. Mode d'emploi**: Connectez l'adaptateur d'alimentation pour allumer l'appareil. Ouvrez 192.168.88.1 dans un navigateur Web pour configurer le produit. Plus d'informations dans \{+\}[https://mt.lv/help-fr](https://mt.lv/help-fr)

**HR. Uputa za uporabu**: Priključite napajanje i uključite uređaj. Za konfiguraciju uređaja u pregledniku otvorite 192.168.88.1. Više informacija je na \{+\}[https://mt.lv/help-hr](https://mt.lv/help-hr)

**HU. Használati utasítás**: Csatlakoztassa a hálózati adaptert a készülék bekapcsolásához. Megnyitása 192.168.88.1 egy webböngészőben beállítani a terméket. Több információ \{+\}[https://mt.lv/help-hu](https://mt.lv/help-hu)

**IT. Manuale di istruzioni**: Collegare l'adattatore di alimentazione per accendere l'unità. Aprire 192.168.88.1 in un browser Web per configurare il prodotto. Maggiori informazioni in \{+\}[https://mt.lv/help-it](https://mt.lv/help-it)

**IS. Notkunarleiðbeiningar**: Tengdu straumbreytinn til að kveikja á tækinu. Opnaðu 192.168.88.1 í vafra til að stilla það. Nánari upplýsingar á \{+\}[https://mt.lv/help-is](https://mt.lv/help-is)

**NO. Instruksjonsmanual**: Koble strømadapteren for å slå på enheten. Åpne 192.168.88.1 i nettleseren din for å konfigurere den. Mer informasjon på \{+\}[https://mt.lv/help-no](https://mt.lv/help-no)

**LT. Naudojimosi instrukcija**: Prijunkite maitinimo adapterį įjunkite įrenginį. Į interneto naršyklę 192.168.88.1 Atidarykite galite konfigūruoti gaminį. Daugiau informacijos rasite \{+\}[https://mt.lv/help-lt](https://mt.lv/help-lt)

**LV. Lietošanas instrukcija**: Pievienojiet Strāvas adapteri, lai ieslēgtu ierīci. Atvērt 192.168.88.1 ar interneta pārlūku, lai konfigurētu produktu. Plašāka informācija \{+\}[https://mt.lv/help-lv](https://mt.lv/help-lv)

**MT. Manwal tal-istruzzjoni**: Qabbad l-adapter tal-qawwa biex iddawwar it-tagħmir. Iftaħ 192.168.88.1 fil-web browser tiegħek, biex jiġi kkonfigurat. Aktar informazzjoni fuq \{+\}[https://mt.lv/help-mt](https://mt.lv/help-mt)

**NL. Handleiding**: Sluit voedingsadapter aan op het apparaat in te schakelen. Open 192.168.88.1 in een webbrowser om het product te configureren. Meer informatie in \{+\}[https://mt.lv/help-nl](https://mt.lv/help-nl)

**PL. Instrukcja obsługi**: Podłącz adapter zasilania, aby włączyć urządzenie. Otwórz 192.168.88.1 w przeglądarce internetowej, aby skonfigurować urządzenie. Więcej informacji w \{+\}[https://mt.lv/help-pl](https://mt.lv/help-pl)

**PT. Manual de instruções**: Conecte o adaptador de alimentação para ligar o aparelho. Abra 192.168.88.1 em um navegador da web para configurar o produto. Mais informações em \{+\}[https://mt.lv/help-pt](https://mt.lv/help-pt)

**RO. Instrucțiuni de utilizare**: Conectați adaptorul de alimentare pentru a porni aparatul. Deschide 192.168.88.1 într-un browser web pentru a configura produsul. Mai multe informații în \{+\}[https://mt.lv/help-ro](https://mt.lv/help-ro)

**SK. Navodila**: Priključite napajalnik za vklop naprave. Odprite 192.168.88.1 v spletnem brskalniku nastaviti izdelek. Več informacij v \{+\}[https://mt.lv/help-sk](https://mt.lv/help-sk)

**SL. Návod na použitie**: Pripojte napájací adaptér k zapnutiu prístroja. Otvorte 192.168.88.1 vo webovom prehliadači pre konfiguráciu produktu. Viac informácií nájdete v \{+\}[https://mt.lv/help-sl](https://mt.lv/help-sl)

**SV. Instruktionsmanual**: Anslut nätadaptern för att slå på enheten. Öppna 192.168.88.1 i en webbläsare för att konfigurera produkten. Mer information på \{+\}[https://mt.lv/help-sv](https://mt.lv/help-sv)

**NO. Bruksanvisningen**: Koble strømadapteren for å slå på enheten. Åpne 192.168.88.1 i en nettleser for å konfigurere produktet. Mer informasjon på \{+\}[https://mt.lv/help-no](https://mt.lv/help-no)

**RU. Руководство по эксплуатации**: подключите адаптер питания чтобы включить устройство. Откройте 192.168.88.1 в своем веб-браузере для конфигурации. Дополнительная информация [https://mt.lv/help-ru](https://mt.lv/help-ru) **CN. 说明书。** 连接电源适配器以打开设备。 在Web浏览器中打开192.168.88.1进行配置。 有关\{+\}[https://mt.lv/help-zh](https://mt.lv/help-zh)

的更多信息

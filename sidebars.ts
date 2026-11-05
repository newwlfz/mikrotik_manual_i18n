import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  "docs": [
    {
      "type": "doc",
      "id": "introduction",
      "label": "Introduction"
    },
    {
      "type": "category",
      "label": "Getting Started",
      "link": {
        "type": "doc",
        "id": "getting-started/index"
      },
      "items": [
        {
          "type": "doc",
          "id": "getting-started/first-time-configuration",
          "label": "First Time Configuration"
        },
        {
          "type": "doc",
          "id": "getting-started/manual-network-setup",
          "label": "Manual Network Setup"
        },
        {
          "type": "doc",
          "id": "getting-started/securing-your-router",
          "label": "Securing your router"
        },
        {
          "type": "category",
          "label": "Networking Fundamentals",
          "link": {
            "type": "doc",
            "id": "getting-started/networking-fundamentals/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "getting-started/networking-fundamentals/ipv6-addresses",
              "label": "IPv6 Addresses"
            },
            {
              "type": "doc",
              "id": "getting-started/networking-fundamentals/ipv6-neighbor-discovery",
              "label": "IPv6 Neighbor Discovery"
            }
          ]
        },
        {
          "type": "category",
          "label": "Installation and Upgrade",
          "link": {
            "type": "doc",
            "id": "getting-started/installation-and-upgrade/index"
          },
          "items": [
            {
              "type": "category",
              "label": "Install",
              "link": {
                "type": "doc",
                "id": "getting-started/installation-and-upgrade/install/chr-installation/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "getting-started/installation-and-upgrade/install/x86-installation",
                  "label": "x86 Installation"
                }
              ]
            },
            {
              "type": "doc",
              "id": "getting-started/installation-and-upgrade/upgrade",
              "label": "Upgrade"
            },
            {
              "type": "doc",
              "id": "getting-started/installation-and-upgrade/upgrade-server",
              "label": "Upgrade Server"
            },
            {
              "type": "category",
              "label": "Netinstall",
              "link": {
                "type": "doc",
                "id": "getting-started/installation-and-upgrade/netinstall/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "getting-started/installation-and-upgrade/netinstall/netinstall-windows",
                  "label": "Netinstall for Windows"
                },
                {
                  "type": "doc",
                  "id": "getting-started/installation-and-upgrade/netinstall/netinstall-linux",
                  "label": "Netinstall for Linux"
                },
                {
                  "type": "doc",
                  "id": "getting-started/installation-and-upgrade/netinstall/netinstall-package",
                  "label": "Netinstall package"
                }
              ]
            },
            {
              "type": "doc",
              "id": "getting-started/installation-and-upgrade/packages",
              "label": "Packages"
            },
            {
              "type": "doc",
              "id": "getting-started/installation-and-upgrade/routerboot",
              "label": "RouterBOOT"
            }
          ]
        },
        {
          "type": "category",
          "label": "Configuration Management",
          "link": {
            "type": "doc",
            "id": "getting-started/configuration-management/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "getting-started/configuration-management/backup",
              "label": "Backup"
            },
            {
              "type": "doc",
              "id": "getting-started/configuration-management/default-configuration-passwords",
              "label": "Default Configuration Passwords"
            },
            {
              "type": "doc",
              "id": "getting-started/configuration-management/default-configurations",
              "label": "Default configurations"
            },
            {
              "type": "doc",
              "id": "getting-started/configuration-management/list-of-menus-with-sensitive-parameters",
              "label": "List of menus with sensitive parameters"
            },
            {
              "type": "doc",
              "id": "getting-started/configuration-management/routeros-configuration-reset",
              "label": "RouterOS configuration reset"
            }
          ]
        },
        {
          "type": "category",
          "label": "RouterOS Licensing",
          "link": {
            "type": "doc",
            "id": "getting-started/routeros-licensing/index"
          },
          "items": [
            {
              "type": "category",
              "label": "Cloud Hosted Router, CHR",
              "link": {
                "type": "doc",
                "id": "getting-started/routeros-licensing/chr/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "getting-started/routeros-licensing/chr/chr-licensing",
                  "label": "CHR: Licensing"
                }
              ]
            },
            {
              "type": "doc",
              "id": "getting-started/routeros-licensing/mikrotik-hardware/index",
              "label": "MikroTik Hardware Licensing"
            },
            {
              "type": "doc",
              "id": "getting-started/routeros-licensing/x86/index",
              "label": "x86 Licensing"
            }
          ]
        },
        {
          "type": "category",
          "label": "Software Specifications",
          "link": {
            "type": "doc",
            "id": "getting-started/software-specifications/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "getting-started/software-specifications/feature-support-based-on-architecture",
              "label": "Feature support based on architecture"
            }
          ]
        },
        {
          "type": "doc",
          "id": "getting-started/upgrading-to-v7",
          "label": "Upgrading to v7"
        },
        {
          "type": "doc",
          "id": "getting-started/supout-rif",
          "label": "Supout.rif"
        }
      ]
    },
    {
      "type": "category",
      "label": "Management Tools",
      "link": {
        "type": "doc",
        "id": "management-tools/index"
      },
      "items": [
        {
          "type": "doc",
          "id": "management-tools/webfig",
          "label": "WebFig"
        },
        {
          "type": "doc",
          "id": "management-tools/winbox",
          "label": "WinBox"
        },
        {
          "type": "doc",
          "id": "management-tools/mikrotik-mobile-app",
          "label": "MikroTik mobile app"
        },
        {
          "type": "doc",
          "id": "management-tools/console",
          "label": "Console"
        },
        {
          "type": "doc",
          "id": "management-tools/serial-console",
          "label": "Serial Console"
        },
        {
          "type": "doc",
          "id": "management-tools/ssh",
          "label": "SSH"
        },
        {
          "type": "doc",
          "id": "management-tools/quick-set",
          "label": "Quick Set"
        },
        {
          "type": "doc",
          "id": "management-tools/flashfig",
          "label": "FlashFig"
        },
        {
          "type": "doc",
          "id": "management-tools/romon",
          "label": "RoMON"
        },
        {
          "type": "doc",
          "id": "management-tools/mac-server",
          "label": "MAC server"
        },
        {
          "type": "doc",
          "id": "management-tools/tr-069",
          "label": "TR-069"
        },
        {
          "type": "doc",
          "id": "management-tools/dude",
          "label": "Dude"
        },
        {
          "type": "doc",
          "id": "management-tools/branding",
          "label": "Branding"
        }
      ]
    },
    {
      "type": "category",
      "label": "System Information and Utilities",
      "link": {
        "type": "doc",
        "id": "system-information-and-utilities/index"
      },
      "items": [
        {
          "type": "doc",
          "id": "system-information-and-utilities/clock",
          "label": "Clock"
        },
        {
          "type": "doc",
          "id": "system-information-and-utilities/device-mode",
          "label": "Device-mode"
        },
        {
          "type": "doc",
          "id": "system-information-and-utilities/e-mail",
          "label": "E-mail"
        },
        {
          "type": "doc",
          "id": "system-information-and-utilities/fetch",
          "label": "Fetch"
        },
        {
          "type": "doc",
          "id": "system-information-and-utilities/files",
          "label": "Files"
        },
        {
          "type": "doc",
          "id": "system-information-and-utilities/identity",
          "label": "Identity"
        },
        {
          "type": "doc",
          "id": "system-information-and-utilities/interface-lists",
          "label": "Interface Lists"
        },
        {
          "type": "doc",
          "id": "system-information-and-utilities/ip-packing",
          "label": "IP packing"
        },
        {
          "type": "doc",
          "id": "system-information-and-utilities/neighbor-discovery",
          "label": "Neighbor discovery"
        },
        {
          "type": "doc",
          "id": "system-information-and-utilities/note",
          "label": "Note"
        },
        {
          "type": "doc",
          "id": "system-information-and-utilities/ntp",
          "label": "NTP"
        },
        {
          "type": "doc",
          "id": "system-information-and-utilities/partitions",
          "label": "Partitions"
        },
        {
          "type": "doc",
          "id": "system-information-and-utilities/precision-time-protocol",
          "label": "Precision Time Protocol"
        },
        {
          "type": "doc",
          "id": "system-information-and-utilities/scheduler",
          "label": "Scheduler"
        },
        {
          "type": "doc",
          "id": "system-information-and-utilities/services",
          "label": "Services"
        },
        {
          "type": "doc",
          "id": "system-information-and-utilities/tftp",
          "label": "TFTP"
        },
        {
          "type": "doc",
          "id": "system-information-and-utilities/ups",
          "label": "UPS"
        },
        {
          "type": "doc",
          "id": "system-information-and-utilities/wake-on-lan",
          "label": "Wake on LAN"
        }
      ]
    },
    {
      "type": "category",
      "label": "Diagnostics and Monitoring",
      "link": {
        "type": "doc",
        "id": "diagnostics-monitoring-and-troubleshooting/index"
      },
      "items": [
        {
          "type": "doc",
          "id": "diagnostics-monitoring-and-troubleshooting/ping",
          "label": "Ping"
        },
        {
          "type": "doc",
          "id": "diagnostics-monitoring-and-troubleshooting/traceroute",
          "label": "Traceroute"
        },
        {
          "type": "doc",
          "id": "diagnostics-monitoring-and-troubleshooting/torch",
          "label": "Torch"
        },
        {
          "type": "doc",
          "id": "diagnostics-monitoring-and-troubleshooting/packet-sniffer",
          "label": "Packet Sniffer"
        },
        {
          "type": "doc",
          "id": "diagnostics-monitoring-and-troubleshooting/bandwidth-test",
          "label": "Bandwidth Test"
        },
        {
          "type": "doc",
          "id": "diagnostics-monitoring-and-troubleshooting/speed-test",
          "label": "Speed Test"
        },
        {
          "type": "doc",
          "id": "diagnostics-monitoring-and-troubleshooting/flood-ping",
          "label": "Flood Ping"
        },
        {
          "type": "doc",
          "id": "diagnostics-monitoring-and-troubleshooting/interface-stats-and-monitor-traffic",
          "label": "Interface stats and monitor-traffic"
        },
        {
          "type": "doc",
          "id": "diagnostics-monitoring-and-troubleshooting/traffic-generator",
          "label": "Traffic Generator"
        },
        {
          "type": "doc",
          "id": "diagnostics-monitoring-and-troubleshooting/netwatch",
          "label": "Netwatch"
        },
        {
          "type": "doc",
          "id": "diagnostics-monitoring-and-troubleshooting/graphing",
          "label": "Graphing"
        },
        {
          "type": "doc",
          "id": "diagnostics-monitoring-and-troubleshooting/snmp",
          "label": "SNMP"
        },
        {
          "type": "doc",
          "id": "diagnostics-monitoring-and-troubleshooting/health",
          "label": "Health"
        },
        {
          "type": "doc",
          "id": "diagnostics-monitoring-and-troubleshooting/resource",
          "label": "Resource"
        },
        {
          "type": "doc",
          "id": "diagnostics-monitoring-and-troubleshooting/profiler",
          "label": "Profiler"
        },
        {
          "type": "doc",
          "id": "diagnostics-monitoring-and-troubleshooting/ip-scan",
          "label": "IP Scan"
        },
        {
          "type": "doc",
          "id": "diagnostics-monitoring-and-troubleshooting/detect-internet",
          "label": "Detect Internet"
        },
        {
          "type": "doc",
          "id": "diagnostics-monitoring-and-troubleshooting/dynamic-dns",
          "label": "Dynamic DNS"
        },
        {
          "type": "doc",
          "id": "diagnostics-monitoring-and-troubleshooting/watchdog",
          "label": "Watchdog"
        },
        {
          "type": "doc",
          "id": "diagnostics-monitoring-and-troubleshooting/downgrading-routeros",
          "label": "Downgrading RouterOS"
        },
        {
          "type": "category",
          "label": "Logs",
          "link": {
            "type": "doc",
            "id": "diagnostics-monitoring-and-troubleshooting/log/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "diagnostics-monitoring-and-troubleshooting/log/cef-with-elasticsearch",
              "label": "CEF with Elasticsearch"
            },
            {
              "type": "doc",
              "id": "diagnostics-monitoring-and-troubleshooting/log/syslog-with-elasticsearch",
              "label": "Syslog with Elasticsearch"
            }
          ]
        },
        {
          "type": "category",
          "label": "Traffic Flow",
          "link": {
            "type": "doc",
            "id": "diagnostics-monitoring-and-troubleshooting/traffic-flow/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "diagnostics-monitoring-and-troubleshooting/traffic-flow/netflow-analysis-with-elasticsearch",
              "label": "NetFlow analysis with Elasticsearch"
            }
          ]
        }
      ]
    },
    {
      "type": "category",
      "label": "Hardware",
      "link": {
        "type": "doc",
        "id": "hardware/index"
      },
      "items": [
        {
          "type": "category",
          "label": "Disks",
          "link": {
            "type": "doc",
            "id": "hardware/disks/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "hardware/disks/smart",
              "label": "S.M.A.R.T. info"
            }
          ]
        },
        {
          "type": "doc",
          "id": "hardware/grounding",
          "label": "Grounding"
        },
        {
          "type": "doc",
          "id": "hardware/lcd-touchscreen",
          "label": "LCD Touchscreen"
        },
        {
          "type": "doc",
          "id": "hardware/leds",
          "label": "LEDs"
        },
        {
          "type": "doc",
          "id": "hardware/mtu-in-routeros",
          "label": "MTU in RouterOS"
        },
        {
          "type": "doc",
          "id": "hardware/peripherals",
          "label": "Peripherals"
        },
        {
          "type": "doc",
          "id": "hardware/poe-out",
          "label": "PoE"
        },
        {
          "type": "doc",
          "id": "hardware/ports",
          "label": "Ports"
        },
        {
          "type": "doc",
          "id": "hardware/product-naming",
          "label": "Product Naming"
        },
        {
          "type": "doc",
          "id": "hardware/routerboard",
          "label": "RouterBOARD"
        },
        {
          "type": "doc",
          "id": "hardware/s-plus-rj10-general-guidance",
          "label": "S+RJ10 general guidance"
        },
        {
          "type": "doc",
          "id": "hardware/try-before-rma",
          "label": "Try Before RMA"
        },
        {
          "type": "doc",
          "id": "hardware/usb-features",
          "label": "USB Features"
        }
      ]
    },
    {
      "type": "category",
      "label": "Wired Connections",
      "link": {
        "type": "doc",
        "id": "wired-connections/index"
      },
      "items": [
        {
          "type": "doc",
          "id": "wired-connections/ethernet",
          "label": "Ethernet"
        },
        {
          "type": "doc",
          "id": "wired-connections/mikrotik-wired-interface-compatibility",
          "label": "MikroTik wired interface compatibility"
        },
        {
          "type": "doc",
          "id": "wired-connections/pwr-line",
          "label": "PWR Line"
        }
      ]
    },
    {
      "type": "category",
      "label": "Wireless",
      "link": {
        "type": "doc",
        "id": "wireless/index"
      },
      "items": [
        {
          "type": "category",
          "label": "Wi-Fi 6 / 7 (802.11ax/be)",
          "link": {
            "type": "doc",
            "id": "wireless/wifi/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "wireless/wifi/capsman",
              "label": "WiFi CAPsMAN"
            },
            {
              "type": "doc",
              "id": "wireless/wifi/configuring-outdoor-cpe-to-ap-links",
              "label": "Configuring outdoor CPE to AP links"
            },
            {
              "type": "doc",
              "id": "wireless/wifi/configuring-repeater",
              "label": "Configuring a wireless repeater"
            },
            {
              "type": "doc",
              "id": "wireless/wifi/configuring-standalone-access-point",
              "label": "Configuring standalone access point"
            },
            {
              "type": "doc",
              "id": "wireless/wifi/interworking-for-wifi6",
              "label": "Interworking for WiFi6"
            }
          ]
        },
        {
          "type": "doc",
          "id": "wireless/wifi-ac/index",
          "label": "Wi-Fi 5 (802.11ac)"
        },
        {
          "type": "category",
          "label": "802.11 a/b/g/n",
          "link": {
            "type": "doc",
            "id": "wireless/abgn/index"
          },
          "items": [
            {
              "type": "category",
              "label": "CAPsMAN",
              "link": {
                "type": "doc",
                "id": "wireless/abgn/capsman/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "wireless/abgn/capsman/ap-controller-capsman",
                  "label": "AP Controller (CAPsMAN)"
                },
                {
                  "type": "doc",
                  "id": "wireless/abgn/capsman/capsman-with-vlans",
                  "label": "CAPsMAN with VLANs"
                }
              ]
            },
            {
              "type": "doc",
              "id": "wireless/abgn/hwmpplus-mesh",
              "label": "HWMPplus mesh"
            },
            {
              "type": "doc",
              "id": "wireless/abgn/interworking-profiles",
              "label": "Interworking Profiles"
            },
            {
              "type": "doc",
              "id": "wireless/abgn/nv2",
              "label": "Nv2"
            },
            {
              "type": "doc",
              "id": "wireless/abgn/spectral-scan",
              "label": "Spectral scan"
            },
            {
              "type": "doc",
              "id": "wireless/abgn/vlans-on-wireless",
              "label": "VLANs on Wireless"
            },
            {
              "type": "doc",
              "id": "wireless/abgn/wireless-interface",
              "label": "Wireless Interface"
            },
            {
              "type": "doc",
              "id": "wireless/abgn/wireless-troubleshooting",
              "label": "Wireless Troubleshooting"
            }
          ]
        },
        {
          "type": "category",
          "label": "60 GHz (W60G)",
          "link": {
            "type": "doc",
            "id": "wireless/w60g/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "wireless/w60g/distance-guide",
              "label": "Distance guide"
            },
            {
              "type": "doc",
              "id": "wireless/w60g/fail-over-ptmp-cli-example",
              "label": "Fail-over PtMP CLI example"
            },
            {
              "type": "doc",
              "id": "wireless/w60g/fail-over-ptp-cli-example",
              "label": "Fail-over PtP CLI example"
            },
            {
              "type": "doc",
              "id": "wireless/w60g/fail-over-ptp-gui-example",
              "label": "Fail-over PtP GUI example"
            },
            {
              "type": "doc",
              "id": "wireless/w60g/ptp-cli-example",
              "label": "PtP CLI example"
            },
            {
              "type": "doc",
              "id": "wireless/w60g/ptp-gui-example",
              "label": "PtP GUI example"
            }
          ]
        },
        {
          "type": "category",
          "label": "User Guides",
          "link": {
            "type": "doc",
            "id": "wireless/user-guides/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "wireless/user-guides/enterprise-wireless-security-user",
              "label": "Enterprise wireless security with User Manager v5"
            },
            {
              "type": "doc",
              "id": "wireless/user-guides/wireless-station-modes",
              "label": "Wireless Station Modes"
            }
          ]
        }
      ]
    },
    {
      "type": "category",
      "label": "Mobile Networking",
      "link": {
        "type": "doc",
        "id": "mobile-networking/index"
      },
      "items": [
        {
          "type": "doc",
          "id": "mobile-networking/lte-5g",
          "label": "LTE/5G"
        },
        {
          "type": "category",
          "label": "GPS",
          "link": {
            "type": "doc",
            "id": "mobile-networking/gps/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "mobile-networking/gps/gps-tracking-using-http-post",
              "label": "GPS-tracking using HTTP POST"
            },
            {
              "type": "doc",
              "id": "mobile-networking/gps/gps-tracking-using-mqtt-and-thingsboard",
              "label": "GPS-tracking using MQTT and ThingsBoard"
            }
          ]
        },
        {
          "type": "doc",
          "id": "mobile-networking/mikrotik-connectivity",
          "label": "MikroTik Connectivity"
        },
        {
          "type": "doc",
          "id": "mobile-networking/sms",
          "label": "SMS"
        },
        {
          "type": "doc",
          "id": "mobile-networking/ppp",
          "label": "PPP"
        },
        {
          "type": "category",
          "label": "User Guides",
          "link": {
            "type": "doc",
            "id": "mobile-networking/bg77-modem-at-commands/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "mobile-networking/dual-sim-application",
              "label": "Dual SIM Application"
            }
          ]
        }
      ]
    },
    {
      "type": "category",
      "label": "Bridging and Switching",
      "link": {
        "type": "doc",
        "id": "bridging-and-switching/index"
      },
      "items": [
        {
          "type": "doc",
          "id": "bridging-and-switching/marvell-prestera-switch-chip-features",
          "label": "Marvell Prestera switch chip features"
        },
        {
          "type": "doc",
          "id": "bridging-and-switching/l3-hardware-offloading",
          "label": "L3 Hardware Offloading"
        },
        {
          "type": "doc",
          "id": "bridging-and-switching/quality-of-service",
          "label": "Quality of Service"
        },
        {
          "type": "doc",
          "id": "bridging-and-switching/macsec",
          "label": "MACsec"
        },
        {
          "type": "doc",
          "id": "bridging-and-switching/macvlan",
          "label": "MACVLAN"
        },
        {
          "type": "doc",
          "id": "bridging-and-switching/vxlan",
          "label": "VXLAN"
        },
        {
          "type": "doc",
          "id": "bridging-and-switching/switch-chip-features",
          "label": "Other Switch Chip Features"
        },
        {
          "type": "doc",
          "id": "bridging-and-switching/crs1xx-and-2xx-series-switches",
          "label": "CRS1xx and 2xx series switches"
        },
        {
          "type": "doc",
          "id": "bridging-and-switching/vlan",
          "label": "VLAN"
        },
        {
          "type": "category",
          "label": "SwOS",
          "link": {
            "type": "doc",
            "id": "bridging-and-switching/swos/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "bridging-and-switching/swos/crs3",
              "label": "CRS3xx and CSS3xx Series Manual"
            },
            {
              "type": "doc",
              "id": "bridging-and-switching/swos/css106",
              "label": "CSS106 (RB260) series Manual"
            },
            {
              "type": "doc",
              "id": "bridging-and-switching/swos/css610",
              "label": "CSS610 series Manual"
            },
            {
              "type": "doc",
              "id": "bridging-and-switching/swos/gpen21",
              "label": "GPEN21 series Manual"
            },
            {
              "type": "doc",
              "id": "bridging-and-switching/swos/troubleshooting",
              "label": "Cannot upgrade SwOS"
            }
          ]
        },
        {
          "type": "category",
          "label": "User Guides",
          "link": {
            "type": "doc",
            "id": "bridging-and-switching/user-guides/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "bridging-and-switching/user-guides/basic-vlan-switching",
              "label": "Basic VLAN switching"
            },
            {
              "type": "doc",
              "id": "bridging-and-switching/user-guides/bridge-igmp-mld-snooping",
              "label": "Bridge IGMP/MLD snooping"
            },
            {
              "type": "doc",
              "id": "bridging-and-switching/user-guides/bridge-vlan-table",
              "label": "Bridge VLAN Table"
            },
            {
              "type": "doc",
              "id": "bridging-and-switching/user-guides/controller-bridge-and-port-extender",
              "label": "Controller Bridge and Port Extender"
            },
            {
              "type": "doc",
              "id": "bridging-and-switching/user-guides/crs1xx-2xx-series-switches-examples",
              "label": "CRS1xx/2xx series switches examples"
            },
            {
              "type": "doc",
              "id": "bridging-and-switching/user-guides/layer2-misconfiguration",
              "label": "Layer2 misconfiguration"
            },
            {
              "type": "doc",
              "id": "bridging-and-switching/user-guides/loop-protect",
              "label": "Loop Protect"
            },
            {
              "type": "doc",
              "id": "bridging-and-switching/user-guides/spanning-tree-protocol",
              "label": "Spanning Tree Protocol"
            },
            {
              "type": "doc",
              "id": "bridging-and-switching/user-guides/wireless-vlan-trunk",
              "label": "Wireless VLAN Trunk"
            },
            {
              "type": "doc",
              "id": "bridging-and-switching/user-guides/wmm-and-vlan-priority",
              "label": "WMM and VLAN priority"
            }
          ]
        }
      ]
    },
    {
      "type": "category",
      "label": "Network Services",
      "link": {
        "type": "doc",
        "id": "network-management/index"
      },
      "items": [
        {
          "type": "doc",
          "id": "network-management/arp",
          "label": "ARP"
        },
        {
          "type": "category",
          "label": "Cloud",
          "link": {
            "type": "doc",
            "id": "network-management/cloud/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "network-management/cloud/back-to-home",
              "label": "Back To Home"
            },
            {
              "type": "doc",
              "id": "network-management/cloud/communication-mikrotik-cloud-servers",
              "label": "Communication with MikroTik Cloud Services"
            },
            {
              "type": "doc",
              "id": "network-management/cloud/file-share",
              "label": "File share"
            }
          ]
        },
        {
          "type": "doc",
          "id": "network-management/dhcp",
          "label": "DHCP"
        },
        {
          "type": "doc",
          "id": "network-management/dns",
          "label": "DNS"
        },
        {
          "type": "doc",
          "id": "network-management/openflow",
          "label": "Openflow"
        },
        {
          "type": "category",
          "label": "Proxy",
          "link": {
            "type": "doc",
            "id": "network-management/proxy/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "network-management/proxy/reverse-proxy",
              "label": "Reverse Proxy"
            }
          ]
        },
        {
          "type": "category",
          "label": "SOCKS",
          "link": {
            "type": "doc",
            "id": "network-management/socks/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "network-management/socks/socksify",
              "label": "Socksify"
            }
          ]
        }
      ]
    },
    {
      "type": "category",
      "label": "Routing and Networking Protocols",
      "link": {
        "type": "doc",
        "id": "user-guides/routing-and-networking-protocols/index"
      },
      "items": [
        {
          "type": "doc",
          "id": "user-guides/routing-and-networking-protocols/routing-decision",
          "label": "Routing Decision"
        },
        {
          "type": "doc",
          "id": "user-guides/routing-and-networking-protocols/moving-from-rosv6-to-rosv7",
          "label": "Moving from ROSv6 to ROSv7"
        },
        {
          "type": "doc",
          "id": "user-guides/routing-and-networking-protocols/routing-protocol-multi-core-support",
          "label": "Routing Protocol Multi-core Support"
        },
        {
          "type": "doc",
          "id": "user-guides/routing-and-networking-protocols/policy-routing",
          "label": "Policy Routing"
        },
        {
          "type": "doc",
          "id": "user-guides/routing-and-networking-protocols/vrf",
          "label": "VRF"
        },
        {
          "type": "category",
          "label": "Unicast",
          "link": {
            "type": "doc",
            "id": "user-guides/routing-and-networking-protocols/unicast/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "user-guides/routing-and-networking-protocols/unicast/bfd",
              "label": "BFD"
            },
            {
              "type": "category",
              "label": "BGP",
              "link": {
                "type": "doc",
                "id": "user-guides/routing-and-networking-protocols/unicast/bgp/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "user-guides/routing-and-networking-protocols/unicast/bgp/understanding-bgp",
                  "label": "Understanding BGP"
                },
                {
                  "type": "doc",
                  "id": "user-guides/routing-and-networking-protocols/unicast/bgp/peering-sessions",
                  "label": "Peering Sessions"
                },
                {
                  "type": "doc",
                  "id": "user-guides/routing-and-networking-protocols/unicast/bgp/nexthop-selection",
                  "label": "Nexthop Selection"
                },
                {
                  "type": "doc",
                  "id": "user-guides/routing-and-networking-protocols/unicast/bgp/faq",
                  "label": "FAQ"
                }
              ]
            },
            {
              "type": "doc",
              "id": "user-guides/routing-and-networking-protocols/unicast/evpn",
              "label": "EVPN"
            },
            {
              "type": "doc",
              "id": "user-guides/routing-and-networking-protocols/unicast/is-is",
              "label": "IS-IS"
            },
            {
              "type": "category",
              "label": "OSPF",
              "link": {
                "type": "doc",
                "id": "user-guides/routing-and-networking-protocols/unicast/ospf/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "user-guides/routing-and-networking-protocols/unicast/ospf/understanding-ospf",
                  "label": "Understanding OSPF"
                },
                {
                  "type": "doc",
                  "id": "user-guides/routing-and-networking-protocols/unicast/ospf/neighbour-relationship",
                  "label": "Neighbor Relationship"
                },
                {
                  "type": "doc",
                  "id": "user-guides/routing-and-networking-protocols/unicast/ospf/routing-calculation",
                  "label": "Routing Table Calculation"
                },
                {
                  "type": "doc",
                  "id": "user-guides/routing-and-networking-protocols/unicast/ospf/areas-and-virtual-links",
                  "label": "Areas and Virtual Links"
                },
                {
                  "type": "doc",
                  "id": "user-guides/routing-and-networking-protocols/unicast/ospf/faq",
                  "label": "FAQ"
                }
              ]
            },
            {
              "type": "doc",
              "id": "user-guides/routing-and-networking-protocols/unicast/rip",
              "label": "RIP"
            },
            {
              "type": "doc",
              "id": "user-guides/routing-and-networking-protocols/unicast/rpki",
              "label": "RPKI"
            }
          ]
        },
        {
          "type": "category",
          "label": "MPLS",
          "link": {
            "type": "doc",
            "id": "user-guides/routing-and-networking-protocols/mpls/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "user-guides/routing-and-networking-protocols/mpls/exp-bit-and-mpls-queuing",
              "label": "EXP bit and MPLS Queuing"
            },
            {
              "type": "doc",
              "id": "user-guides/routing-and-networking-protocols/mpls/ldp",
              "label": "LDP"
            },
            {
              "type": "doc",
              "id": "user-guides/routing-and-networking-protocols/mpls/traffic-eng",
              "label": "Traffic Eng"
            },
            {
              "type": "category",
              "label": "VPLS",
              "link": {
                "type": "doc",
                "id": "user-guides/routing-and-networking-protocols/mpls/vpls/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "user-guides/routing-and-networking-protocols/mpls/vpls/control-word",
                  "label": "Control Word"
                }
              ]
            }
          ]
        },
        {
          "type": "category",
          "label": "Multicast",
          "link": {
            "type": "doc",
            "id": "user-guides/routing-and-networking-protocols/multicast/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "user-guides/routing-and-networking-protocols/multicast/group-management-protocol",
              "label": "Group Management Protocol"
            },
            {
              "type": "doc",
              "id": "user-guides/routing-and-networking-protocols/multicast/igmp-proxy",
              "label": "IGMP Proxy"
            },
            {
              "type": "doc",
              "id": "user-guides/routing-and-networking-protocols/multicast/pim-sm",
              "label": "PIM-SM"
            }
          ]
        },
        {
          "type": "doc",
          "id": "user-guides/routing-and-networking-protocols/route-distinguisher-and-route-target",
          "label": "Route Distinguisher and Route Target"
        },
        {
          "type": "doc",
          "id": "user-guides/routing-and-networking-protocols/route-selection-and-filtering",
          "label": "Route Selection and Filtering"
        }
      ]
    },
    {
      "type": "category",
      "label": "Firewall and Quality of Service",
      "link": {
        "type": "doc",
        "id": "firewall-and-quality-of-service/index"
      },
      "items": [
        {
          "type": "category",
          "label": "Firewall",
          "link": {
            "type": "doc",
            "id": "firewall-and-quality-of-service/firewall/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "firewall-and-quality-of-service/firewall/address-lists",
              "label": "Address-lists"
            },
            {
              "type": "doc",
              "id": "firewall-and-quality-of-service/firewall/common-firewall-matchers-and-actions",
              "label": "Common Firewall Matchers and Actions"
            },
            {
              "type": "doc",
              "id": "firewall-and-quality-of-service/firewall/filter",
              "label": "Filter"
            },
            {
              "type": "doc",
              "id": "firewall-and-quality-of-service/firewall/layer7",
              "label": "Layer7"
            },
            {
              "type": "doc",
              "id": "firewall-and-quality-of-service/firewall/mangle",
              "label": "Mangle"
            },
            {
              "type": "doc",
              "id": "firewall-and-quality-of-service/firewall/nat",
              "label": "NAT"
            }
          ]
        },
        {
          "type": "doc",
          "id": "firewall-and-quality-of-service/packet-flow-in-routeros",
          "label": "Packet Flow in RouterOS"
        },
        {
          "type": "doc",
          "id": "firewall-and-quality-of-service/connection-tracking",
          "label": "Connection tracking"
        },
        {
          "type": "category",
          "label": "Queues",
          "link": {
            "type": "doc",
            "id": "firewall-and-quality-of-service/queues/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "firewall-and-quality-of-service/queues/htb-hierarchical-token-bucket",
              "label": "HTB (Hierarchical Token Bucket)"
            },
            {
              "type": "doc",
              "id": "firewall-and-quality-of-service/queues/pcq-example",
              "label": "PCQ example"
            },
            {
              "type": "doc",
              "id": "firewall-and-quality-of-service/queues/queue-burst",
              "label": "Queue Burst"
            },
            {
              "type": "doc",
              "id": "firewall-and-quality-of-service/queues/queue-size",
              "label": "Queue size"
            },
            {
              "type": "category",
              "label": "Queue types",
              "link": {
                "type": "doc",
                "id": "firewall-and-quality-of-service/queues/queue-types/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "firewall-and-quality-of-service/queues/queue-types/cake",
                  "label": "CAKE"
                },
                {
                  "type": "doc",
                  "id": "firewall-and-quality-of-service/queues/queue-types/pfifo-bfifo",
                  "label": "PFIFO,BFIFO"
                }
              ]
            }
          ]
        },
        {
          "type": "doc",
          "id": "firewall-and-quality-of-service/kid-control",
          "label": "Kid Control"
        },
        {
          "type": "doc",
          "id": "firewall-and-quality-of-service/nat-pmp",
          "label": "NAT-PMP"
        },
        {
          "type": "doc",
          "id": "firewall-and-quality-of-service/upnp",
          "label": "UPnP"
        },
        {
          "type": "category",
          "label": "User Guides",
          "link": {
            "type": "doc",
            "id": "firewall-and-quality-of-service/user-guides/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "firewall-and-quality-of-service/user-guides/bruteforce-prevention",
              "label": "Bruteforce prevention"
            },
            {
              "type": "doc",
              "id": "firewall-and-quality-of-service/user-guides/building-advanced-firewall",
              "label": "Building Advanced Firewall"
            },
            {
              "type": "doc",
              "id": "firewall-and-quality-of-service/user-guides/connection-rate",
              "label": "Connection rate"
            },
            {
              "type": "doc",
              "id": "firewall-and-quality-of-service/user-guides/ddos-protection",
              "label": "DDoS Protection"
            },
            {
              "type": "doc",
              "id": "firewall-and-quality-of-service/user-guides/port-knocking",
              "label": "Port knocking"
            }
          ]
        }
      ]
    },
    {
      "type": "category",
      "label": "Virtual Private Networks",
      "link": {
        "type": "doc",
        "id": "virtual-private-networks/index"
      },
      "items": [
        {
          "type": "doc",
          "id": "virtual-private-networks/6to4",
          "label": "6to4"
        },
        {
          "type": "doc",
          "id": "virtual-private-networks/eoip",
          "label": "EoIP"
        },
        {
          "type": "doc",
          "id": "virtual-private-networks/gre",
          "label": "GRE"
        },
        {
          "type": "doc",
          "id": "virtual-private-networks/ipip",
          "label": "IPIP"
        },
        {
          "type": "category",
          "label": "IPsec",
          "link": {
            "type": "doc",
            "id": "virtual-private-networks/ipsec/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "virtual-private-networks/ipsec/ikev2-eap-between-nordvpn-and-routeros",
              "label": "IKEv2 EAP between NordVPN and RouterOS"
            },
            {
              "type": "doc",
              "id": "virtual-private-networks/ipsec/qkd-integration-in-routeros-ipsec-ppk",
              "label": "QKD Integration in RouterOS IPsec (PPK)"
            }
          ]
        },
        {
          "type": "category",
          "label": "L2TP",
          "link": {
            "type": "doc",
            "id": "virtual-private-networks/l2tp/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "virtual-private-networks/l2tp/lac-and-lns-setup-with-cisco-as-lac",
              "label": "LAC and LNS setup with Cisco as LAC"
            }
          ]
        },
        {
          "type": "doc",
          "id": "virtual-private-networks/openvpn",
          "label": "OpenVPN"
        },
        {
          "type": "category",
          "label": "PPPoE",
          "link": {
            "type": "doc",
            "id": "virtual-private-networks/pppoe/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "virtual-private-networks/pppoe/ipv6-pd-over-ppp",
              "label": "IPv6 PD over PPP"
            },
            {
              "type": "doc",
              "id": "virtual-private-networks/pppoe/mlppp-over-single-and-multiple-links",
              "label": "MLPPP over single and multiple links"
            }
          ]
        },
        {
          "type": "doc",
          "id": "virtual-private-networks/pptp",
          "label": "PPTP"
        },
        {
          "type": "doc",
          "id": "virtual-private-networks/sstp",
          "label": "SSTP"
        },
        {
          "type": "doc",
          "id": "virtual-private-networks/wireguard",
          "label": "WireGuard"
        },
        {
          "type": "doc",
          "id": "virtual-private-networks/zerotier",
          "label": "ZeroTier"
        }
      ]
    },
    {
      "type": "category",
      "label": "AAA and User Management",
      "link": {
        "type": "doc",
        "id": "authentication-authorization-accounting/index"
      },
      "items": [
        {
          "type": "doc",
          "id": "authentication-authorization-accounting/certificates",
          "label": "Certificates"
        },
        {
          "type": "doc",
          "id": "authentication-authorization-accounting/dot1x",
          "label": "Dot1X"
        },
        {
          "type": "category",
          "label": "HotSpot - Captive portal",
          "link": {
            "type": "doc",
            "id": "authentication-authorization-accounting/hotspot-captive-portal/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "authentication-authorization-accounting/hotspot-captive-portal/hotspot-customisation",
              "label": "Hotspot customisation"
            }
          ]
        },
        {
          "type": "doc",
          "id": "authentication-authorization-accounting/ppp-aaa",
          "label": "PPP AAA"
        },
        {
          "type": "doc",
          "id": "authentication-authorization-accounting/radius",
          "label": "RADIUS"
        },
        {
          "type": "doc",
          "id": "authentication-authorization-accounting/user-manager",
          "label": "User Manager"
        },
        {
          "type": "doc",
          "id": "authentication-authorization-accounting/user",
          "label": "User"
        }
      ]
    },
    {
      "type": "category",
      "label": "High Availability Solutions",
      "link": {
        "type": "doc",
        "id": "high-availability-solutions/index"
      },
      "items": [
        {
          "type": "doc",
          "id": "high-availability-solutions/bonding",
          "label": "Bonding"
        },
        {
          "type": "category",
          "label": "Load Balancing",
          "link": {
            "type": "doc",
            "id": "high-availability-solutions/load-balancing/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "high-availability-solutions/load-balancing/failover-wan-backup",
              "label": "Failover (WAN Backup)"
            },
            {
              "type": "doc",
              "id": "high-availability-solutions/load-balancing/per-connection-classifier",
              "label": "Per connection classifier"
            }
          ]
        },
        {
          "type": "doc",
          "id": "high-availability-solutions/multi-chassis-link-aggregation-group",
          "label": "Multi-chassis Link Aggregation Group"
        },
        {
          "type": "category",
          "label": "User Guides",
          "link": {
            "type": "doc",
            "id": "high-availability-solutions/user-guides/bonding-examples"
          },
          "items": []
        },
        {
          "type": "doc",
          "id": "high-availability-solutions/vrrp",
          "label": "VRRP"
        }
      ]
    },
    {
      "type": "category",
      "label": "Internet of Things",
      "link": {
        "type": "doc",
        "id": "internet-of-things/index"
      },
      "items": [
        {
          "type": "category",
          "label": "Bluetooth",
          "link": {
            "type": "doc",
            "id": "internet-of-things/bluetooth/index"
          },
          "items": [
            {
              "type": "category",
              "label": "MikroTik Beacon Manager",
              "link": {
                "type": "doc",
                "id": "internet-of-things/bluetooth/mikrotik-beacon-manager/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "internet-of-things/bluetooth/mikrotik-beacon-manager/mikrotik-beacon-manager-android-devices",
                  "label": "MikroTik Beacon Manager for Android devices"
                },
                {
                  "type": "doc",
                  "id": "internet-of-things/bluetooth/mikrotik-beacon-manager/mikrotik-beacon-manager-for-ios-devices",
                  "label": "MikroTik Beacon Manager for iOS devices"
                },
                {
                  "type": "doc",
                  "id": "internet-of-things/bluetooth/mikrotik-beacon-manager/mikrotik-bluetooth-tg-bt5-xx-tag",
                  "label": "MikroTik Bluetooth TG-BT5-XX tag changelog"
                },
                {
                  "type": "doc",
                  "id": "internet-of-things/bluetooth/mikrotik-beacon-manager/mikrotik-tag-advertisement-formats",
                  "label": "MikroTik Tag advertisement formats"
                }
              ]
            }
          ]
        },
        {
          "type": "category",
          "label": "GPIO",
          "link": {
            "type": "doc",
            "id": "internet-of-things/gpio/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "internet-of-things/gpio/using-gpio-as-pulse-input-from-meter",
              "label": "Using the GPIO as pulse input from a meter device"
            }
          ]
        },
        {
          "type": "category",
          "label": "Lora",
          "link": {
            "type": "doc",
            "id": "internet-of-things/lora/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "internet-of-things/lora/general-properties",
              "label": "General Properties"
            },
            {
              "type": "category",
              "label": "User Guides",
              "link": {
                "type": "doc",
                "id": "internet-of-things/lora/user-guides/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "internet-of-things/lora/user-guides/aws-lorawan-configuration",
                  "label": "AWS LoRaWAN configuration"
                },
                {
                  "type": "doc",
                  "id": "internet-of-things/lora/user-guides/chirpstack",
                  "label": "ChirpStack"
                },
                {
                  "type": "doc",
                  "id": "internet-of-things/lora/user-guides/step-by-step-installation",
                  "label": "Step by step installation"
                },
                {
                  "type": "doc",
                  "id": "internet-of-things/lora/user-guides/tg-lr-setup-guide",
                  "label": "TG-LR setup guide"
                },
                {
                  "type": "doc",
                  "id": "internet-of-things/lora/user-guides/the-things-stack",
                  "label": "The Things Stack"
                }
              ]
            }
          ]
        },
        {
          "type": "doc",
          "id": "internet-of-things/modbus",
          "label": "Modbus"
        },
        {
          "type": "category",
          "label": "MQTT",
          "link": {
            "type": "doc",
            "id": "internet-of-things/mqtt/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "internet-of-things/mqtt/kaa-iot-setup",
              "label": "Kaa IoT setup"
            },
            {
              "type": "doc",
              "id": "internet-of-things/mqtt/mqtt-and-thingsboard-configuration",
              "label": "MQTT and ThingsBoard configuration"
            }
          ]
        },
        {
          "type": "doc",
          "id": "internet-of-things/wiliot",
          "label": "Wiliot"
        }
      ]
    },
    {
      "type": "category",
      "label": "Storage",
      "link": {
        "type": "doc",
        "id": "storage/index"
      },
      "items": [
        {
          "type": "category",
          "label": "Btrfs",
          "link": {
            "type": "doc",
            "id": "storage/btrfs/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "storage/btrfs/maintenance",
              "label": "Btrfs maintenance"
            },
            {
              "type": "doc",
              "id": "storage/btrfs/raid",
              "label": "Btrfs RAID"
            },
            {
              "type": "doc",
              "id": "storage/btrfs/snapshots",
              "label": "Btrfs subvolumes and snapshots"
            }
          ]
        },
        {
          "type": "doc",
          "id": "storage/dlna",
          "label": "DLNA Media Server"
        },
        {
          "type": "doc",
          "id": "storage/encrypted-storage",
          "label": "Encrypted storage (dm-crypt)"
        },
        {
          "type": "doc",
          "id": "storage/iscsi",
          "label": "iSCSI"
        },
        {
          "type": "doc",
          "id": "storage/nfs",
          "label": "NFS"
        },
        {
          "type": "doc",
          "id": "storage/nvme-over-tcp",
          "label": "NVMe over TCP"
        },
        {
          "type": "category",
          "label": "RAID",
          "link": {
            "type": "doc",
            "id": "storage/raid/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "storage/raid/hot-spare",
              "label": "Setting a hot spare disk"
            },
            {
              "type": "doc",
              "id": "storage/raid/moving-array",
              "label": "Moving your RAID array to a different device"
            }
          ]
        },
        {
          "type": "doc",
          "id": "storage/ramdisk",
          "label": "Ramdisk"
        },
        {
          "type": "doc",
          "id": "storage/rsync",
          "label": "Rsync"
        },
        {
          "type": "doc",
          "id": "storage/self-encrypting-drives",
          "label": "Self-encrypting drives (SED)"
        },
        {
          "type": "doc",
          "id": "storage/smb",
          "label": "SMB"
        },
        {
          "type": "doc",
          "id": "storage/tmpfs",
          "label": "Tmpfs"
        }
      ]
    },
    {
      "type": "category",
      "label": "Containers",
      "link": {
        "type": "doc",
        "id": "containers/index"
      },
      "items": [
        {
          "type": "category",
          "label": "Apps",
          "link": {
            "type": "doc",
            "id": "containers/apps/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "containers/apps/available-apps",
              "label": "List of available Apps"
            }
          ]
        },
        {
          "type": "doc",
          "id": "containers/veth",
          "label": "VETH"
        }
      ]
    },
    {
      "type": "category",
      "label": "Developer Guides",
      "link": {
        "type": "doc",
        "id": "developer-guides/index"
      },
      "items": [
        {
          "type": "category",
          "label": "API",
          "link": {
            "type": "doc",
            "id": "developer-guides/api/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "developer-guides/api/python3-example",
              "label": "Python3 Example"
            }
          ]
        },
        {
          "type": "doc",
          "id": "developer-guides/rest-api",
          "label": "REST API"
        },
        {
          "type": "category",
          "label": "Scripting",
          "link": {
            "type": "doc",
            "id": "developer-guides/scripting/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "developer-guides/scripting/scripting-examples",
              "label": "Scripting examples"
            },
            {
              "type": "doc",
              "id": "developer-guides/scripting/scripting-tips-and-tricks",
              "label": "Scripting Tips and Tricks"
            }
          ]
        }
      ]
    },
    {
      "type": "category",
      "label": "CLI Reference",
      "link": {
        "type": "doc",
        "id": "cli-reference/index"
      },
      "items": [
        {
          "type": "doc",
          "id": "cli-reference/compare-versions",
          "label": "Version comparison"
        },
        {
          "type": "category",
          "label": "app",
          "link": {
            "type": "doc",
            "id": "cli-reference/app/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "cli-reference/app/cleanup",
              "label": "cleanup"
            },
            {
              "type": "doc",
              "id": "cli-reference/app/network",
              "label": "network"
            },
            {
              "type": "doc",
              "id": "cli-reference/app/remove",
              "label": "remove"
            },
            {
              "type": "doc",
              "id": "cli-reference/app/restart",
              "label": "restart"
            },
            {
              "type": "doc",
              "id": "cli-reference/app/settings",
              "label": "settings"
            },
            {
              "type": "doc",
              "id": "cli-reference/app/setup",
              "label": "setup"
            },
            {
              "type": "doc",
              "id": "cli-reference/app/update",
              "label": "update"
            }
          ]
        },
        {
          "type": "doc",
          "id": "cli-reference/beep",
          "label": "beep"
        },
        {
          "type": "doc",
          "id": "cli-reference/blink",
          "label": "blink"
        },
        {
          "type": "category",
          "label": "certificate",
          "link": {
            "type": "doc",
            "id": "cli-reference/certificate/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "cli-reference/certificate/acme-renew",
              "label": "acme-renew"
            },
            {
              "type": "doc",
              "id": "cli-reference/certificate/add-acme",
              "label": "add-acme"
            },
            {
              "type": "doc",
              "id": "cli-reference/certificate/add-scep",
              "label": "add-scep"
            },
            {
              "type": "doc",
              "id": "cli-reference/certificate/builtin",
              "label": "builtin"
            },
            {
              "type": "doc",
              "id": "cli-reference/certificate/card-reinstall",
              "label": "card-reinstall"
            },
            {
              "type": "doc",
              "id": "cli-reference/certificate/card-verify",
              "label": "card-verify"
            },
            {
              "type": "doc",
              "id": "cli-reference/certificate/create-certificate-request",
              "label": "create-certificate-request"
            },
            {
              "type": "category",
              "label": "crl",
              "link": {
                "type": "doc",
                "id": "cli-reference/certificate/crl/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/certificate/crl/download",
                  "label": "download"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/certificate/crl/flush",
                  "label": "flush"
                }
              ]
            },
            {
              "type": "doc",
              "id": "cli-reference/certificate/enable-ssl-certificate",
              "label": "enable-ssl-certificate"
            },
            {
              "type": "doc",
              "id": "cli-reference/certificate/export-certificate",
              "label": "export-certificate"
            },
            {
              "type": "doc",
              "id": "cli-reference/certificate/import",
              "label": "import"
            },
            {
              "type": "doc",
              "id": "cli-reference/certificate/issued-revoke",
              "label": "issued-revoke"
            },
            {
              "type": "doc",
              "id": "cli-reference/certificate/scep-renew",
              "label": "scep-renew"
            },
            {
              "type": "category",
              "label": "scep-server",
              "link": {
                "type": "doc",
                "id": "cli-reference/certificate/scep-server/index"
              },
              "items": [
                {
                  "type": "category",
                  "label": "otp",
                  "link": {
                    "type": "doc",
                    "id": "cli-reference/certificate/scep-server/otp/index"
                  },
                  "items": [
                    {
                      "type": "doc",
                      "id": "cli-reference/certificate/scep-server/otp/generate",
                      "label": "generate"
                    }
                  ]
                },
                {
                  "type": "category",
                  "label": "ra",
                  "link": {
                    "type": "doc",
                    "id": "cli-reference/certificate/scep-server/ra/index"
                  },
                  "items": [
                    {
                      "type": "doc",
                      "id": "cli-reference/certificate/scep-server/ra/renew",
                      "label": "renew"
                    }
                  ]
                },
                {
                  "type": "category",
                  "label": "requests",
                  "link": {
                    "type": "doc",
                    "id": "cli-reference/certificate/scep-server/requests/index"
                  },
                  "items": [
                    {
                      "type": "doc",
                      "id": "cli-reference/certificate/scep-server/requests/grant",
                      "label": "grant"
                    }
                  ]
                }
              ]
            },
            {
              "type": "doc",
              "id": "cli-reference/certificate/settings",
              "label": "settings"
            },
            {
              "type": "doc",
              "id": "cli-reference/certificate/sign-certificate-request",
              "label": "sign-certificate-request"
            },
            {
              "type": "doc",
              "id": "cli-reference/certificate/sign",
              "label": "sign"
            }
          ]
        },
        {
          "type": "category",
          "label": "container",
          "link": {
            "type": "doc",
            "id": "cli-reference/container/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "cli-reference/container/config",
              "label": "config"
            },
            {
              "type": "doc",
              "id": "cli-reference/container/envs",
              "label": "envs"
            },
            {
              "type": "doc",
              "id": "cli-reference/container/kill",
              "label": "kill"
            },
            {
              "type": "doc",
              "id": "cli-reference/container/layers",
              "label": "layers"
            },
            {
              "type": "doc",
              "id": "cli-reference/container/log",
              "label": "log"
            },
            {
              "type": "doc",
              "id": "cli-reference/container/mounts",
              "label": "mounts"
            },
            {
              "type": "doc",
              "id": "cli-reference/container/repull",
              "label": "repull"
            },
            {
              "type": "doc",
              "id": "cli-reference/container/restart",
              "label": "restart"
            },
            {
              "type": "doc",
              "id": "cli-reference/container/save",
              "label": "save"
            },
            {
              "type": "doc",
              "id": "cli-reference/container/start",
              "label": "start"
            },
            {
              "type": "doc",
              "id": "cli-reference/container/stop",
              "label": "stop"
            },
            {
              "type": "doc",
              "id": "cli-reference/container/update",
              "label": "update"
            }
          ]
        },
        {
          "type": "category",
          "label": "disk",
          "link": {
            "type": "doc",
            "id": "cli-reference/disk/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "cli-reference/disk/blink",
              "label": "blink"
            },
            {
              "type": "category",
              "label": "btrfs",
              "link": {
                "type": "doc",
                "id": "cli-reference/disk/btrfs/index"
              },
              "items": [
                {
                  "type": "category",
                  "label": "filesystem",
                  "link": {
                    "type": "doc",
                    "id": "cli-reference/disk/btrfs/filesystem/index"
                  },
                  "items": [
                    {
                      "type": "doc",
                      "id": "cli-reference/disk/btrfs/filesystem/add-device",
                      "label": "add-device"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/disk/btrfs/filesystem/balance-cancel",
                      "label": "balance-cancel"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/disk/btrfs/filesystem/balance-start",
                      "label": "balance-start"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/disk/btrfs/filesystem/remove-device",
                      "label": "remove-device"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/disk/btrfs/filesystem/replace-cancel",
                      "label": "replace-cancel"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/disk/btrfs/filesystem/replace-device",
                      "label": "replace-device"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/disk/btrfs/filesystem/reset-counters",
                      "label": "reset-counters"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/disk/btrfs/filesystem/scrub-cancel",
                      "label": "scrub-cancel"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/disk/btrfs/filesystem/scrub-start",
                      "label": "scrub-start"
                    }
                  ]
                },
                {
                  "type": "doc",
                  "id": "cli-reference/disk/btrfs/subvolume",
                  "label": "subvolume"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/disk/btrfs/transfer",
                  "label": "transfer"
                }
              ]
            },
            {
              "type": "doc",
              "id": "cli-reference/disk/check",
              "label": "check"
            },
            {
              "type": "doc",
              "id": "cli-reference/disk/copy",
              "label": "copy"
            },
            {
              "type": "doc",
              "id": "cli-reference/disk/eject",
              "label": "eject"
            },
            {
              "type": "doc",
              "id": "cli-reference/disk/format",
              "label": "format"
            },
            {
              "type": "doc",
              "id": "cli-reference/disk/monitor-traffic",
              "label": "monitor-traffic"
            },
            {
              "type": "doc",
              "id": "cli-reference/disk/nvme-discover",
              "label": "nvme-discover"
            },
            {
              "type": "doc",
              "id": "cli-reference/disk/raid-scrub-cancel",
              "label": "raid-scrub-cancel"
            },
            {
              "type": "doc",
              "id": "cli-reference/disk/raid-scrub",
              "label": "raid-scrub"
            },
            {
              "type": "doc",
              "id": "cli-reference/disk/repair",
              "label": "repair"
            },
            {
              "type": "doc",
              "id": "cli-reference/disk/reset-counters",
              "label": "reset-counters"
            },
            {
              "type": "doc",
              "id": "cli-reference/disk/scan",
              "label": "scan"
            },
            {
              "type": "doc",
              "id": "cli-reference/disk/settings",
              "label": "settings"
            },
            {
              "type": "doc",
              "id": "cli-reference/disk/smart-info",
              "label": "smart-info"
            },
            {
              "type": "doc",
              "id": "cli-reference/disk/test",
              "label": "test"
            },
            {
              "type": "doc",
              "id": "cli-reference/disk/trim",
              "label": "trim"
            }
          ]
        },
        {
          "type": "category",
          "label": "dude",
          "link": {
            "type": "doc",
            "id": "cli-reference/dude/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "cli-reference/dude/agent",
              "label": "agent"
            },
            {
              "type": "doc",
              "id": "cli-reference/dude/device-type",
              "label": "device-type"
            },
            {
              "type": "doc",
              "id": "cli-reference/dude/device",
              "label": "device"
            },
            {
              "type": "doc",
              "id": "cli-reference/dude/export-db",
              "label": "export-db"
            },
            {
              "type": "doc",
              "id": "cli-reference/dude/import-db",
              "label": "import-db"
            },
            {
              "type": "doc",
              "id": "cli-reference/dude/notification",
              "label": "notification"
            },
            {
              "type": "doc",
              "id": "cli-reference/dude/probe",
              "label": "probe"
            },
            {
              "type": "category",
              "label": "ros",
              "link": {
                "type": "doc",
                "id": "cli-reference/dude/ros/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/dude/ros/address",
                  "label": "address"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/dude/ros/arp",
                  "label": "arp"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/dude/ros/health",
                  "label": "health"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/dude/ros/interface",
                  "label": "interface"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/dude/ros/lease",
                  "label": "lease"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/dude/ros/neighbor",
                  "label": "neighbor"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/dude/ros/queue",
                  "label": "queue"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/dude/ros/registration-table",
                  "label": "registration-table"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/dude/ros/resource",
                  "label": "resource"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/dude/ros/route",
                  "label": "route"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/dude/ros/routerboard",
                  "label": "routerboard"
                }
              ]
            },
            {
              "type": "doc",
              "id": "cli-reference/dude/service",
              "label": "service"
            },
            {
              "type": "doc",
              "id": "cli-reference/dude/settings",
              "label": "settings"
            },
            {
              "type": "doc",
              "id": "cli-reference/dude/vacuum-db",
              "label": "vacuum-db"
            }
          ]
        },
        {
          "type": "doc",
          "id": "cli-reference/environment",
          "label": "environment"
        },
        {
          "type": "category",
          "label": "file",
          "link": {
            "type": "doc",
            "id": "cli-reference/file/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "cli-reference/file/copy",
              "label": "copy"
            },
            {
              "type": "doc",
              "id": "cli-reference/file/head",
              "label": "head"
            },
            {
              "type": "doc",
              "id": "cli-reference/file/read",
              "label": "read"
            },
            {
              "type": "doc",
              "id": "cli-reference/file/rsync-daemon",
              "label": "rsync-daemon"
            },
            {
              "type": "category",
              "label": "sync",
              "link": {
                "type": "doc",
                "id": "cli-reference/file/sync/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/file/sync/monitor",
                  "label": "monitor"
                }
              ]
            },
            {
              "type": "doc",
              "id": "cli-reference/file/tail",
              "label": "tail"
            }
          ]
        },
        {
          "type": "doc",
          "id": "cli-reference/import",
          "label": "import"
        },
        {
          "type": "category",
          "label": "interface",
          "link": {
            "type": "doc",
            "id": "cli-reference/interface/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "cli-reference/interface/6to4",
              "label": "6to4"
            },
            {
              "type": "doc",
              "id": "cli-reference/interface/blink",
              "label": "blink"
            },
            {
              "type": "category",
              "label": "bonding",
              "link": {
                "type": "doc",
                "id": "cli-reference/interface/bonding/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/interface/bonding/monitor-slaves",
                  "label": "monitor-slaves"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/bonding/monitor",
                  "label": "monitor"
                }
              ]
            },
            {
              "type": "category",
              "label": "bridge",
              "link": {
                "type": "doc",
                "id": "cli-reference/interface/bridge/index"
              },
              "items": [
                {
                  "type": "category",
                  "label": "calea",
                  "link": {
                    "type": "doc",
                    "id": "cli-reference/interface/bridge/calea/index"
                  },
                  "items": [
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/bridge/calea/reset-counters-all",
                      "label": "reset-counters-all"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/bridge/calea/reset-counters",
                      "label": "reset-counters"
                    }
                  ]
                },
                {
                  "type": "category",
                  "label": "filter",
                  "link": {
                    "type": "doc",
                    "id": "cli-reference/interface/bridge/filter/index"
                  },
                  "items": [
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/bridge/filter/reset-counters-all",
                      "label": "reset-counters-all"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/bridge/filter/reset-counters",
                      "label": "reset-counters"
                    }
                  ]
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/bridge/host",
                  "label": "host"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/bridge/mdb",
                  "label": "mdb"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/bridge/monitor",
                  "label": "monitor"
                },
                {
                  "type": "category",
                  "label": "msrp",
                  "link": {
                    "type": "doc",
                    "id": "cli-reference/interface/bridge/msrp/index"
                  },
                  "items": [
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/bridge/msrp/attributes",
                      "label": "attributes"
                    },
                    {
                      "type": "category",
                      "label": "domain",
                      "link": {
                        "type": "doc",
                        "id": "cli-reference/interface/bridge/msrp/domain/index"
                      },
                      "items": [
                        {
                          "type": "doc",
                          "id": "cli-reference/interface/bridge/msrp/domain/attributes",
                          "label": "attributes"
                        },
                        {
                          "type": "doc",
                          "id": "cli-reference/interface/bridge/msrp/domain/monitor",
                          "label": "monitor"
                        }
                      ]
                    }
                  ]
                },
                {
                  "type": "category",
                  "label": "msti",
                  "link": {
                    "type": "doc",
                    "id": "cli-reference/interface/bridge/msti/index"
                  },
                  "items": [
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/bridge/msti/monitor",
                      "label": "monitor"
                    }
                  ]
                },
                {
                  "type": "category",
                  "label": "nat",
                  "link": {
                    "type": "doc",
                    "id": "cli-reference/interface/bridge/nat/index"
                  },
                  "items": [
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/bridge/nat/reset-counters-all",
                      "label": "reset-counters-all"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/bridge/nat/reset-counters",
                      "label": "reset-counters"
                    }
                  ]
                },
                {
                  "type": "category",
                  "label": "port",
                  "link": {
                    "type": "doc",
                    "id": "cli-reference/interface/bridge/port/index"
                  },
                  "items": [
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/bridge/port/monitor",
                      "label": "monitor"
                    },
                    {
                      "type": "category",
                      "label": "mst-override",
                      "link": {
                        "type": "doc",
                        "id": "cli-reference/interface/bridge/port/mst-override/index"
                      },
                      "items": [
                        {
                          "type": "doc",
                          "id": "cli-reference/interface/bridge/port/mst-override/monitor",
                          "label": "monitor"
                        }
                      ]
                    }
                  ]
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/bridge/settings",
                  "label": "settings"
                },
                {
                  "type": "category",
                  "label": "vlan",
                  "link": {
                    "type": "doc",
                    "id": "cli-reference/interface/bridge/vlan/index"
                  },
                  "items": [
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/bridge/vlan/mvrp",
                      "label": "mvrp"
                    }
                  ]
                }
              ]
            },
            {
              "type": "category",
              "label": "detect-internet",
              "link": {
                "type": "doc",
                "id": "cli-reference/interface/detect-internet/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/interface/detect-internet/state",
                  "label": "state"
                }
              ]
            },
            {
              "type": "category",
              "label": "dot1x",
              "link": {
                "type": "doc",
                "id": "cli-reference/interface/dot1x/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/interface/dot1x/client",
                  "label": "client"
                },
                {
                  "type": "category",
                  "label": "server",
                  "link": {
                    "type": "doc",
                    "id": "cli-reference/interface/dot1x/server/index"
                  },
                  "items": [
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/dot1x/server/active",
                      "label": "active"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/dot1x/server/state",
                      "label": "state"
                    }
                  ]
                }
              ]
            },
            {
              "type": "doc",
              "id": "cli-reference/interface/eoip",
              "label": "eoip"
            },
            {
              "type": "doc",
              "id": "cli-reference/interface/eoipv6",
              "label": "eoipv6"
            },
            {
              "type": "category",
              "label": "ethernet",
              "link": {
                "type": "doc",
                "id": "cli-reference/interface/ethernet/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/interface/ethernet/blink",
                  "label": "blink"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/ethernet/cable-test",
                  "label": "cable-test"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/ethernet/monitor",
                  "label": "monitor"
                },
                {
                  "type": "category",
                  "label": "poe",
                  "link": {
                    "type": "doc",
                    "id": "cli-reference/interface/ethernet/poe/index"
                  },
                  "items": [
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/ethernet/poe/monitor",
                      "label": "monitor"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/ethernet/poe/power-cycle",
                      "label": "power-cycle"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/ethernet/poe/settings",
                      "label": "settings"
                    }
                  ]
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/ethernet/reset-counters",
                  "label": "reset-counters"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/ethernet/reset-mac-address",
                  "label": "reset-mac-address"
                },
                {
                  "type": "category",
                  "label": "switch",
                  "link": {
                    "type": "doc",
                    "id": "cli-reference/interface/ethernet/switch/index"
                  },
                  "items": [
                    {
                      "type": "category",
                      "label": "acl",
                      "link": {
                        "type": "doc",
                        "id": "cli-reference/interface/ethernet/switch/acl/index"
                      },
                      "items": [
                        {
                          "type": "doc",
                          "id": "cli-reference/interface/ethernet/switch/acl/policer",
                          "label": "policer"
                        }
                      ]
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/ethernet/switch/dscp-qos-map",
                      "label": "dscp-qos-map"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/ethernet/switch/dscp-to-dscp",
                      "label": "dscp-to-dscp"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/ethernet/switch/egress-vlan-tag",
                      "label": "egress-vlan-tag"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/ethernet/switch/egress-vlan-translation",
                      "label": "egress-vlan-translation"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/ethernet/switch/host",
                      "label": "host"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/ethernet/switch/ingress-port-policer",
                      "label": "ingress-port-policer"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/ethernet/switch/ingress-vlan-translation",
                      "label": "ingress-vlan-translation"
                    },
                    {
                      "type": "category",
                      "label": "l3hw-settings",
                      "link": {
                        "type": "doc",
                        "id": "cli-reference/interface/ethernet/switch/l3hw-settings/index"
                      },
                      "items": [
                        {
                          "type": "category",
                          "label": "advanced",
                          "link": {
                            "type": "doc",
                            "id": "cli-reference/interface/ethernet/switch/l3hw-settings/advanced/index"
                          },
                          "items": [
                            {
                              "type": "doc",
                              "id": "cli-reference/interface/ethernet/switch/l3hw-settings/advanced/monitor",
                              "label": "monitor"
                            }
                          ]
                        },
                        {
                          "type": "doc",
                          "id": "cli-reference/interface/ethernet/switch/l3hw-settings/monitor",
                          "label": "monitor"
                        }
                      ]
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/ethernet/switch/mac-based-vlan",
                      "label": "mac-based-vlan"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/ethernet/switch/multicast-fdb",
                      "label": "multicast-fdb"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/ethernet/switch/one2one-vlan-switching",
                      "label": "one2one-vlan-switching"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/ethernet/switch/policer-qos-map",
                      "label": "policer-qos-map"
                    },
                    {
                      "type": "category",
                      "label": "port",
                      "link": {
                        "type": "doc",
                        "id": "cli-reference/interface/ethernet/switch/port/index"
                      },
                      "items": [
                        {
                          "type": "doc",
                          "id": "cli-reference/interface/ethernet/switch/port/reset-counters/index",
                          "label": "reset-counters"
                        }
                      ]
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/ethernet/switch/port-isolation/index",
                      "label": "port-isolation"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/ethernet/switch/port-leakage",
                      "label": "port-leakage"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/ethernet/switch/protocol-based-vlan",
                      "label": "protocol-based-vlan"
                    },
                    {
                      "type": "category",
                      "label": "qos",
                      "link": {
                        "type": "doc",
                        "id": "cli-reference/interface/ethernet/switch/qos/index"
                      },
                      "items": [
                        {
                          "type": "category",
                          "label": "map",
                          "link": {
                            "type": "doc",
                            "id": "cli-reference/interface/ethernet/switch/qos/map/index"
                          },
                          "items": [
                            {
                              "type": "doc",
                              "id": "cli-reference/interface/ethernet/switch/qos/map/ip",
                              "label": "ip"
                            },
                            {
                              "type": "doc",
                              "id": "cli-reference/interface/ethernet/switch/qos/map/vlan",
                              "label": "vlan"
                            }
                          ]
                        },
                        {
                          "type": "doc",
                          "id": "cli-reference/interface/ethernet/switch/qos/monitor",
                          "label": "monitor"
                        },
                        {
                          "type": "category",
                          "label": "port",
                          "link": {
                            "type": "doc",
                            "id": "cli-reference/interface/ethernet/switch/qos/port/index"
                          },
                          "items": [
                            {
                              "type": "doc",
                              "id": "cli-reference/interface/ethernet/switch/qos/port/reset-counters",
                              "label": "reset-counters"
                            }
                          ]
                        },
                        {
                          "type": "doc",
                          "id": "cli-reference/interface/ethernet/switch/qos/priority-flow-control",
                          "label": "priority-flow-control"
                        },
                        {
                          "type": "doc",
                          "id": "cli-reference/interface/ethernet/switch/qos/profile",
                          "label": "profile"
                        },
                        {
                          "type": "doc",
                          "id": "cli-reference/interface/ethernet/switch/qos/settings",
                          "label": "settings"
                        },
                        {
                          "type": "category",
                          "label": "tx-manager",
                          "link": {
                            "type": "doc",
                            "id": "cli-reference/interface/ethernet/switch/qos/tx-manager/index"
                          },
                          "items": [
                            {
                              "type": "doc",
                              "id": "cli-reference/interface/ethernet/switch/qos/tx-manager/queue",
                              "label": "queue"
                            }
                          ]
                        }
                      ]
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/ethernet/switch/qos-group",
                      "label": "qos-group"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/ethernet/switch/reserved-fdb",
                      "label": "reserved-fdb"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/ethernet/switch/reset-counters/index",
                      "label": "reset-counters"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/ethernet/switch/rule",
                      "label": "rule"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/ethernet/switch/shaper",
                      "label": "shaper"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/ethernet/switch/stats",
                      "label": "stats"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/ethernet/switch/trunk",
                      "label": "trunk"
                    },
                    {
                      "type": "category",
                      "label": "unicast-fdb",
                      "link": {
                        "type": "doc",
                        "id": "cli-reference/interface/ethernet/switch/unicast-fdb/index"
                      },
                      "items": [
                        {
                          "type": "doc",
                          "id": "cli-reference/interface/ethernet/switch/unicast-fdb/flush",
                          "label": "flush"
                        }
                      ]
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/ethernet/switch/vlan/index",
                      "label": "vlan"
                    }
                  ]
                }
              ]
            },
            {
              "type": "doc",
              "id": "cli-reference/interface/gre",
              "label": "gre"
            },
            {
              "type": "doc",
              "id": "cli-reference/interface/gre6",
              "label": "gre6"
            },
            {
              "type": "doc",
              "id": "cli-reference/interface/ipip",
              "label": "ipip"
            },
            {
              "type": "doc",
              "id": "cli-reference/interface/ipipv6",
              "label": "ipipv6"
            },
            {
              "type": "category",
              "label": "l2tp-client",
              "link": {
                "type": "doc",
                "id": "cli-reference/interface/l2tp-client/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/interface/l2tp-client/monitor",
                  "label": "monitor"
                }
              ]
            },
            {
              "type": "category",
              "label": "l2tp-ether",
              "link": {
                "type": "doc",
                "id": "cli-reference/interface/l2tp-ether/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/interface/l2tp-ether/monitor",
                  "label": "monitor"
                }
              ]
            },
            {
              "type": "category",
              "label": "l2tp-server",
              "link": {
                "type": "doc",
                "id": "cli-reference/interface/l2tp-server/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/interface/l2tp-server/monitor",
                  "label": "monitor"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/l2tp-server/server",
                  "label": "server"
                }
              ]
            },
            {
              "type": "category",
              "label": "list",
              "link": {
                "type": "doc",
                "id": "cli-reference/interface/list/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/interface/list/member",
                  "label": "member"
                }
              ]
            },
            {
              "type": "category",
              "label": "lte",
              "link": {
                "type": "doc",
                "id": "cli-reference/interface/lte/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/interface/lte/apn",
                  "label": "apn"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/lte/at-chat",
                  "label": "at-chat"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/lte/cell-monitor",
                  "label": "cell-monitor"
                },
                {
                  "type": "category",
                  "label": "esim",
                  "link": {
                    "type": "doc",
                    "id": "cli-reference/interface/lte/esim/index"
                  },
                  "items": [
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/lte/esim/activate",
                      "label": "activate"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/lte/esim/deactivate",
                      "label": "deactivate"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/lte/esim/delete",
                      "label": "delete"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/lte/esim/esim-id",
                      "label": "esim-id"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/lte/esim/provision",
                      "label": "provision"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/lte/esim/refresh-profile-list",
                      "label": "refresh-profile-list"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/lte/esim/send-notifications",
                      "label": "send-notifications"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/lte/esim/set-nickname",
                      "label": "set-nickname"
                    }
                  ]
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/lte/firmware-upgrade",
                  "label": "firmware-upgrade"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/lte/monitor",
                  "label": "monitor"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/lte/scan",
                  "label": "scan"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/lte/settings",
                  "label": "settings"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/lte/show-capabilities",
                  "label": "show-capabilities"
                }
              ]
            },
            {
              "type": "category",
              "label": "macsec",
              "link": {
                "type": "doc",
                "id": "cli-reference/interface/macsec/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/interface/macsec/monitor",
                  "label": "monitor"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/macsec/profile",
                  "label": "profile"
                }
              ]
            },
            {
              "type": "doc",
              "id": "cli-reference/interface/macvlan",
              "label": "macvlan"
            },
            {
              "type": "category",
              "label": "mesh",
              "link": {
                "type": "doc",
                "id": "cli-reference/interface/mesh/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/interface/mesh/fdb",
                  "label": "fdb"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/mesh/port",
                  "label": "port"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/mesh/traceroute",
                  "label": "traceroute"
                }
              ]
            },
            {
              "type": "doc",
              "id": "cli-reference/interface/monitor-traffic",
              "label": "monitor-traffic"
            },
            {
              "type": "category",
              "label": "ovpn-client",
              "link": {
                "type": "doc",
                "id": "cli-reference/interface/ovpn-client/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/interface/ovpn-client/import-ovpn-configuration",
                  "label": "import-ovpn-configuration"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/ovpn-client/monitor",
                  "label": "monitor"
                }
              ]
            },
            {
              "type": "category",
              "label": "ovpn-server",
              "link": {
                "type": "doc",
                "id": "cli-reference/interface/ovpn-server/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/interface/ovpn-server/monitor",
                  "label": "monitor"
                },
                {
                  "type": "category",
                  "label": "server",
                  "link": {
                    "type": "doc",
                    "id": "cli-reference/interface/ovpn-server/server/index"
                  },
                  "items": [
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/ovpn-server/server/export-client-configuration",
                      "label": "export-client-configuration"
                    }
                  ]
                }
              ]
            },
            {
              "type": "category",
              "label": "ppp-client",
              "link": {
                "type": "doc",
                "id": "cli-reference/interface/ppp-client/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/interface/ppp-client/at-chat",
                  "label": "at-chat"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/ppp-client/firmware-upgrade",
                  "label": "firmware-upgrade"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/ppp-client/info",
                  "label": "info"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/ppp-client/monitor",
                  "label": "monitor"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/ppp-client/scan",
                  "label": "scan"
                }
              ]
            },
            {
              "type": "category",
              "label": "ppp-server",
              "link": {
                "type": "doc",
                "id": "cli-reference/interface/ppp-server/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/interface/ppp-server/monitor",
                  "label": "monitor"
                }
              ]
            },
            {
              "type": "category",
              "label": "pppoe-client",
              "link": {
                "type": "doc",
                "id": "cli-reference/interface/pppoe-client/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/interface/pppoe-client/monitor",
                  "label": "monitor"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/pppoe-client/scan",
                  "label": "scan"
                }
              ]
            },
            {
              "type": "category",
              "label": "pppoe-server",
              "link": {
                "type": "doc",
                "id": "cli-reference/interface/pppoe-server/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/interface/pppoe-server/monitor",
                  "label": "monitor"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/pppoe-server/server",
                  "label": "server"
                }
              ]
            },
            {
              "type": "category",
              "label": "pptp-client",
              "link": {
                "type": "doc",
                "id": "cli-reference/interface/pptp-client/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/interface/pptp-client/monitor",
                  "label": "monitor"
                }
              ]
            },
            {
              "type": "category",
              "label": "pptp-server",
              "link": {
                "type": "doc",
                "id": "cli-reference/interface/pptp-server/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/interface/pptp-server/monitor",
                  "label": "monitor"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/pptp-server/server",
                  "label": "server"
                }
              ]
            },
            {
              "type": "category",
              "label": "pwr-line",
              "link": {
                "type": "doc",
                "id": "cli-reference/interface/pwr-line/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/interface/pwr-line/blink",
                  "label": "blink"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/pwr-line/configure",
                  "label": "configure"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/pwr-line/join",
                  "label": "join"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/pwr-line/leave",
                  "label": "leave"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/pwr-line/monitor",
                  "label": "monitor"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/pwr-line/reset-counters",
                  "label": "reset-counters"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/pwr-line/reset-mac-address",
                  "label": "reset-mac-address"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/pwr-line/upgrade-firmware",
                  "label": "upgrade-firmware"
                }
              ]
            },
            {
              "type": "doc",
              "id": "cli-reference/interface/reset-counters",
              "label": "reset-counters"
            },
            {
              "type": "category",
              "label": "sstp-client",
              "link": {
                "type": "doc",
                "id": "cli-reference/interface/sstp-client/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/interface/sstp-client/monitor",
                  "label": "monitor"
                }
              ]
            },
            {
              "type": "category",
              "label": "sstp-server",
              "link": {
                "type": "doc",
                "id": "cli-reference/interface/sstp-server/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/interface/sstp-server/monitor",
                  "label": "monitor"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/sstp-server/server",
                  "label": "server"
                }
              ]
            },
            {
              "type": "doc",
              "id": "cli-reference/interface/veth",
              "label": "veth"
            },
            {
              "type": "doc",
              "id": "cli-reference/interface/vlan",
              "label": "vlan"
            },
            {
              "type": "category",
              "label": "vpls",
              "link": {
                "type": "doc",
                "id": "cli-reference/interface/vpls/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/interface/vpls/monitor",
                  "label": "monitor"
                }
              ]
            },
            {
              "type": "doc",
              "id": "cli-reference/interface/vrrp",
              "label": "vrrp"
            },
            {
              "type": "category",
              "label": "vxlan",
              "link": {
                "type": "doc",
                "id": "cli-reference/interface/vxlan/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/interface/vxlan/fdb",
                  "label": "fdb"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/vxlan/vteps",
                  "label": "vteps"
                }
              ]
            },
            {
              "type": "category",
              "label": "w60g",
              "link": {
                "type": "doc",
                "id": "cli-reference/interface/w60g/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/interface/w60g/align",
                  "label": "align"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/w60g/monitor",
                  "label": "monitor"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/w60g/reset-configuration",
                  "label": "reset-configuration"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/w60g/scan",
                  "label": "scan"
                },
                {
                  "type": "category",
                  "label": "station",
                  "link": {
                    "type": "doc",
                    "id": "cli-reference/interface/w60g/station/index"
                  },
                  "items": [
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/w60g/station/monitor",
                      "label": "monitor"
                    }
                  ]
                }
              ]
            },
            {
              "type": "category",
              "label": "wifi",
              "link": {
                "type": "doc",
                "id": "cli-reference/interface/wifi/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wifi/aaa",
                  "label": "aaa"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wifi/access-list",
                  "label": "access-list"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wifi/cap",
                  "label": "cap"
                },
                {
                  "type": "category",
                  "label": "capsman",
                  "link": {
                    "type": "doc",
                    "id": "cli-reference/interface/wifi/capsman/index"
                  },
                  "items": [
                    {
                      "type": "category",
                      "label": "remote-cap",
                      "link": {
                        "type": "doc",
                        "id": "cli-reference/interface/wifi/capsman/remote-cap/index"
                      },
                      "items": [
                        {
                          "type": "doc",
                          "id": "cli-reference/interface/wifi/capsman/remote-cap/provision",
                          "label": "provision"
                        },
                        {
                          "type": "doc",
                          "id": "cli-reference/interface/wifi/capsman/remote-cap/set-identity",
                          "label": "set-identity"
                        },
                        {
                          "type": "doc",
                          "id": "cli-reference/interface/wifi/capsman/remote-cap/upgrade",
                          "label": "upgrade"
                        }
                      ]
                    }
                  ]
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wifi/channel",
                  "label": "channel"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wifi/configuration",
                  "label": "configuration"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wifi/datapath",
                  "label": "datapath"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wifi/devel",
                  "label": "devel"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wifi/flat-snoop",
                  "label": "flat-snoop"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wifi/frequency-scan",
                  "label": "frequency-scan"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wifi/interworking",
                  "label": "interworking"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wifi/liberate",
                  "label": "liberate"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wifi/monitor",
                  "label": "monitor"
                },
                {
                  "type": "category",
                  "label": "network",
                  "link": {
                    "type": "doc",
                    "id": "cli-reference/interface/wifi/network/index"
                  },
                  "items": [
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/wifi/network/radio",
                      "label": "radio"
                    }
                  ]
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wifi/provisioning",
                  "label": "provisioning"
                },
                {
                  "type": "category",
                  "label": "radio",
                  "link": {
                    "type": "doc",
                    "id": "cli-reference/interface/wifi/radio/index"
                  },
                  "items": [
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/wifi/radio/provision",
                      "label": "provision"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/wifi/radio/reg-info",
                      "label": "reg-info"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/wifi/radio/settings",
                      "label": "settings"
                    }
                  ]
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wifi/registration-table",
                  "label": "registration-table"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wifi/reset-mac-address",
                  "label": "reset-mac-address"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wifi/roam",
                  "label": "roam"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wifi/scan",
                  "label": "scan"
                },
                {
                  "type": "category",
                  "label": "security",
                  "link": {
                    "type": "doc",
                    "id": "cli-reference/interface/wifi/security/index"
                  },
                  "items": [
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/wifi/security/multi-passphrase",
                      "label": "multi-passphrase"
                    }
                  ]
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wifi/sniffer",
                  "label": "sniffer"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wifi/spectral-scan",
                  "label": "spectral-scan"
                },
                {
                  "type": "category",
                  "label": "steering",
                  "link": {
                    "type": "doc",
                    "id": "cli-reference/interface/wifi/steering/index"
                  },
                  "items": [
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/wifi/steering/neighbor-group",
                      "label": "neighbor-group"
                    }
                  ]
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wifi/trigger-radar",
                  "label": "trigger-radar"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wifi/wps-client",
                  "label": "wps-client"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wifi/wps-push-button",
                  "label": "wps-push-button"
                }
              ]
            },
            {
              "type": "category",
              "label": "wireguard",
              "link": {
                "type": "doc",
                "id": "cli-reference/interface/wireguard/index"
              },
              "items": [
                {
                  "type": "category",
                  "label": "peers",
                  "link": {
                    "type": "doc",
                    "id": "cli-reference/interface/wireguard/peers/index"
                  },
                  "items": [
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/wireguard/peers/show-client-config",
                      "label": "show-client-config"
                    }
                  ]
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wireguard/wg-export",
                  "label": "wg-export"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wireguard/wg-import",
                  "label": "wg-import"
                }
              ]
            },
            {
              "type": "category",
              "label": "wireless",
              "link": {
                "type": "doc",
                "id": "cli-reference/interface/wireless/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wireless/access-list",
                  "label": "access-list"
                },
                {
                  "type": "category",
                  "label": "align",
                  "link": {
                    "type": "doc",
                    "id": "cli-reference/interface/wireless/align/index"
                  },
                  "items": [
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/wireless/align/monitor",
                      "label": "monitor"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/wireless/align/test-audio",
                      "label": "test-audio"
                    }
                  ]
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wireless/cap",
                  "label": "cap"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wireless/channels",
                  "label": "channels"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wireless/connect-list",
                  "label": "connect-list"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wireless/frequency-monitor",
                  "label": "frequency-monitor"
                },
                {
                  "type": "category",
                  "label": "info",
                  "link": {
                    "type": "doc",
                    "id": "cli-reference/interface/wireless/info/index"
                  },
                  "items": [
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/wireless/info/allowed-channels",
                      "label": "allowed-channels"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/wireless/info/country-info",
                      "label": "country-info"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/wireless/info/country-list",
                      "label": "country-list"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/wireless/info/default-scan-list",
                      "label": "default-scan-list"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/wireless/info/hw-info",
                      "label": "hw-info"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/wireless/info/scan-list",
                      "label": "scan-list"
                    }
                  ]
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wireless/interworking-profiles",
                  "label": "interworking-profiles"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wireless/manual-tx-power-table",
                  "label": "manual-tx-power-table"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wireless/monitor",
                  "label": "monitor"
                },
                {
                  "type": "category",
                  "label": "nstreme-dual",
                  "link": {
                    "type": "doc",
                    "id": "cli-reference/interface/wireless/nstreme-dual/index"
                  },
                  "items": [
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/wireless/nstreme-dual/monitor",
                      "label": "monitor"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/wireless/nstreme-dual/reset-counters",
                      "label": "reset-counters"
                    }
                  ]
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wireless/nstreme",
                  "label": "nstreme"
                },
                {
                  "type": "category",
                  "label": "registration-table",
                  "link": {
                    "type": "doc",
                    "id": "cli-reference/interface/wireless/registration-table/index"
                  },
                  "items": [
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/wireless/registration-table/reset-counters",
                      "label": "reset-counters"
                    }
                  ]
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wireless/reset-configuration",
                  "label": "reset-configuration"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wireless/reset-mac-address",
                  "label": "reset-mac-address"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wireless/scan",
                  "label": "scan"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wireless/security-profiles",
                  "label": "security-profiles"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wireless/setup-repeater",
                  "label": "setup-repeater"
                },
                {
                  "type": "category",
                  "label": "sniffer",
                  "link": {
                    "type": "doc",
                    "id": "cli-reference/interface/wireless/sniffer/index"
                  },
                  "items": [
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/wireless/sniffer/packet",
                      "label": "packet"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/wireless/sniffer/save",
                      "label": "save"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/wireless/sniffer/sniff",
                      "label": "sniff"
                    }
                  ]
                },
                {
                  "type": "category",
                  "label": "snooper",
                  "link": {
                    "type": "doc",
                    "id": "cli-reference/interface/wireless/snooper/index"
                  },
                  "items": [
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/wireless/snooper/flat-snoop",
                      "label": "flat-snoop"
                    },
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/wireless/snooper/snoop",
                      "label": "snoop"
                    }
                  ]
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wireless/spectral-scan",
                  "label": "spectral-scan"
                },
                {
                  "type": "category",
                  "label": "wds",
                  "link": {
                    "type": "doc",
                    "id": "cli-reference/interface/wireless/wds/index"
                  },
                  "items": [
                    {
                      "type": "doc",
                      "id": "cli-reference/interface/wireless/wds/monitor",
                      "label": "monitor"
                    }
                  ]
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wireless/wps-client",
                  "label": "wps-client"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/interface/wireless/wps-push-button",
                  "label": "wps-push-button"
                }
              ]
            }
          ]
        },
        {
          "type": "category",
          "label": "lcd",
          "link": {
            "type": "doc",
            "id": "cli-reference/lcd/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "cli-reference/lcd/backlight",
              "label": "backlight"
            },
            {
              "type": "category",
              "label": "interface",
              "link": {
                "type": "doc",
                "id": "cli-reference/lcd/interface/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/lcd/interface/default-wireless",
                  "label": "default-wireless"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/lcd/interface/display",
                  "label": "display"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/lcd/interface/pages",
                  "label": "pages"
                }
              ]
            },
            {
              "type": "doc",
              "id": "cli-reference/lcd/pin",
              "label": "pin"
            },
            {
              "type": "doc",
              "id": "cli-reference/lcd/recalibrate",
              "label": "recalibrate"
            },
            {
              "type": "doc",
              "id": "cli-reference/lcd/screen",
              "label": "screen"
            },
            {
              "type": "doc",
              "id": "cli-reference/lcd/show",
              "label": "show"
            },
            {
              "type": "doc",
              "id": "cli-reference/lcd/take-screenshot",
              "label": "take-screenshot"
            }
          ]
        },
        {
          "type": "doc",
          "id": "cli-reference/log",
          "label": "log"
        },
        {
          "type": "category",
          "label": "openflow",
          "link": {
            "type": "doc",
            "id": "cli-reference/openflow/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "cli-reference/openflow/flow",
              "label": "flow"
            },
            {
              "type": "doc",
              "id": "cli-reference/openflow/group",
              "label": "group"
            },
            {
              "type": "doc",
              "id": "cli-reference/openflow/meter",
              "label": "meter"
            },
            {
              "type": "doc",
              "id": "cli-reference/openflow/port",
              "label": "port"
            }
          ]
        },
        {
          "type": "category",
          "label": "partitions",
          "link": {
            "type": "doc",
            "id": "cli-reference/partitions/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "cli-reference/partitions/activate",
              "label": "activate"
            },
            {
              "type": "doc",
              "id": "cli-reference/partitions/copy-to",
              "label": "copy-to"
            },
            {
              "type": "doc",
              "id": "cli-reference/partitions/repartition",
              "label": "repartition"
            },
            {
              "type": "doc",
              "id": "cli-reference/partitions/restore-config-from",
              "label": "restore-config-from"
            },
            {
              "type": "doc",
              "id": "cli-reference/partitions/save-config-to",
              "label": "save-config-to"
            }
          ]
        },
        {
          "type": "doc",
          "id": "cli-reference/password",
          "label": "password"
        },
        {
          "type": "category",
          "label": "port",
          "link": {
            "type": "doc",
            "id": "cli-reference/port/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "cli-reference/port/remote-access",
              "label": "remote-access"
            }
          ]
        },
        {
          "type": "doc",
          "id": "cli-reference/quit",
          "label": "quit"
        },
        {
          "type": "category",
          "label": "radius",
          "link": {
            "type": "doc",
            "id": "cli-reference/radius/index"
          },
          "items": [
            {
              "type": "category",
              "label": "incoming",
              "link": {
                "type": "doc",
                "id": "cli-reference/radius/incoming/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/radius/incoming/monitor",
                  "label": "monitor"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/radius/incoming/reset-counters",
                  "label": "reset-counters"
                }
              ]
            },
            {
              "type": "doc",
              "id": "cli-reference/radius/monitor",
              "label": "monitor"
            },
            {
              "type": "doc",
              "id": "cli-reference/radius/reset-counters",
              "label": "reset-counters"
            }
          ]
        },
        {
          "type": "doc",
          "id": "cli-reference/redo",
          "label": "redo"
        },
        {
          "type": "doc",
          "id": "cli-reference/safe-mode",
          "label": "safe-mode"
        },
        {
          "type": "category",
          "label": "snmp",
          "link": {
            "type": "doc",
            "id": "cli-reference/snmp/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "cli-reference/snmp/community",
              "label": "community"
            },
            {
              "type": "doc",
              "id": "cli-reference/snmp/send-trap",
              "label": "send-trap"
            }
          ]
        },
        {
          "type": "doc",
          "id": "cli-reference/special-login",
          "label": "special-login"
        },
        {
          "type": "category",
          "label": "task",
          "link": {
            "type": "doc",
            "id": "cli-reference/task/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "cli-reference/task/add",
              "label": "add"
            },
            {
              "type": "doc",
              "id": "cli-reference/task/next",
              "label": "next"
            },
            {
              "type": "doc",
              "id": "cli-reference/task/terminate",
              "label": "terminate"
            }
          ]
        },
        {
          "type": "category",
          "label": "tr069-client",
          "link": {
            "type": "doc",
            "id": "cli-reference/tr069-client/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "cli-reference/tr069-client/reset-tr069-config",
              "label": "reset-tr069-config"
            }
          ]
        },
        {
          "type": "doc",
          "id": "cli-reference/undo",
          "label": "undo"
        },
        {
          "type": "category",
          "label": "user",
          "link": {
            "type": "doc",
            "id": "cli-reference/user/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "cli-reference/user/aaa",
              "label": "aaa"
            },
            {
              "type": "doc",
              "id": "cli-reference/user/active",
              "label": "active"
            },
            {
              "type": "doc",
              "id": "cli-reference/user/expire-password",
              "label": "expire-password"
            },
            {
              "type": "doc",
              "id": "cli-reference/user/group",
              "label": "group"
            },
            {
              "type": "doc",
              "id": "cli-reference/user/settings",
              "label": "settings"
            },
            {
              "type": "category",
              "label": "ssh-keys",
              "link": {
                "type": "doc",
                "id": "cli-reference/user/ssh-keys/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/user/ssh-keys/import",
                  "label": "import"
                },
                {
                  "type": "category",
                  "label": "private",
                  "link": {
                    "type": "doc",
                    "id": "cli-reference/user/ssh-keys/private/index"
                  },
                  "items": [
                    {
                      "type": "doc",
                      "id": "cli-reference/user/ssh-keys/private/import",
                      "label": "import"
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          "type": "category",
          "label": "user-manager",
          "link": {
            "type": "doc",
            "id": "cli-reference/user-manager/index"
          },
          "items": [
            {
              "type": "doc",
              "id": "cli-reference/user-manager/advanced",
              "label": "advanced"
            },
            {
              "type": "doc",
              "id": "cli-reference/user-manager/attribute",
              "label": "attribute"
            },
            {
              "type": "category",
              "label": "database",
              "link": {
                "type": "doc",
                "id": "cli-reference/user-manager/database/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/user-manager/database/load",
                  "label": "load"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/user-manager/database/migrate-legacy-db",
                  "label": "migrate-legacy-db"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/user-manager/database/optimize-db",
                  "label": "optimize-db"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/user-manager/database/save",
                  "label": "save"
                }
              ]
            },
            {
              "type": "doc",
              "id": "cli-reference/user-manager/generate-report",
              "label": "generate-report"
            },
            {
              "type": "doc",
              "id": "cli-reference/user-manager/limitation",
              "label": "limitation"
            },
            {
              "type": "doc",
              "id": "cli-reference/user-manager/monitor",
              "label": "monitor"
            },
            {
              "type": "doc",
              "id": "cli-reference/user-manager/payment",
              "label": "payment"
            },
            {
              "type": "doc",
              "id": "cli-reference/user-manager/profile-limitation",
              "label": "profile-limitation"
            },
            {
              "type": "doc",
              "id": "cli-reference/user-manager/profile",
              "label": "profile"
            },
            {
              "type": "category",
              "label": "router",
              "link": {
                "type": "doc",
                "id": "cli-reference/user-manager/router/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/user-manager/router/monitor",
                  "label": "monitor"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/user-manager/router/reset-counters",
                  "label": "reset-counters"
                }
              ]
            },
            {
              "type": "category",
              "label": "session",
              "link": {
                "type": "doc",
                "id": "cli-reference/user-manager/session/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/user-manager/session/close-session",
                  "label": "close-session"
                }
              ]
            },
            {
              "type": "category",
              "label": "user",
              "link": {
                "type": "doc",
                "id": "cli-reference/user-manager/user/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/user-manager/user/add-batch-users",
                  "label": "add-batch-users"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/user-manager/user/generate-voucher",
                  "label": "generate-voucher"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/user-manager/user/group",
                  "label": "group"
                },
                {
                  "type": "doc",
                  "id": "cli-reference/user-manager/user/monitor",
                  "label": "monitor"
                }
              ]
            },
            {
              "type": "category",
              "label": "user-profile",
              "link": {
                "type": "doc",
                "id": "cli-reference/user-manager/user-profile/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/user-manager/user-profile/activate-user-profile",
                  "label": "activate-user-profile"
                }
              ]
            }
          ]
        },
        {
          "type": "category",
          "label": "zerotier",
          "link": {
            "type": "doc",
            "id": "cli-reference/zerotier/index"
          },
          "items": [
            {
              "type": "category",
              "label": "controller",
              "link": {
                "type": "doc",
                "id": "cli-reference/zerotier/controller/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/zerotier/controller/member",
                  "label": "member"
                }
              ]
            },
            {
              "type": "doc",
              "id": "cli-reference/zerotier/interface",
              "label": "interface"
            },
            {
              "type": "category",
              "label": "peer",
              "link": {
                "type": "doc",
                "id": "cli-reference/zerotier/peer/index"
              },
              "items": [
                {
                  "type": "doc",
                  "id": "cli-reference/zerotier/peer/hint",
                  "label": "hint"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
};

export default sidebars;

---
sidebar_key: "hardware/grounding"
sidebar_position: 2
title: "Grounding"
sidebar_label: 'Grounding'
description: 'Grounding requirements for MikroTik RouterOS devices emphasize proper installation of shielded cables, lightning arresters, and reliable grounding infrastructure using 2.5-4 mm² Cu wire with corrosion-resistant connectors, including specific attachment points on RouterBOARD units.'
tags:
  - 'grounding'
source: https://manual.mikrotik.com/docs/7.24/hardware/grounding
captured_at: '2026-11-04T11:31:26+08:00'
---

## Introduction

Shielded cable installation infrastructure (towers and masts), as well as antennas and the router itself, must be properly grounded. Lightning arresters must be installed on all external antenna cables (near the antennas or on the antennas themselves) to prevent equipment damage and human injury. Note that lightning arresters will not be effective if they are not properly grounded.

Use 2.5-4 mm² Cu (AWG 11–13) wire with corrosion-resistant connectors for grounding. Ensure that the grounding infrastructure you use is fully functional (not merely decorative, as seen in some installations):

1. For shielded connectors, please use shielded cables as they provide better immunity.
2. The grounding wire should be connected to the RouterBOARD grounding wire attachment point if such is provided. This wire should then be connected to the base of the tower, ensuring the connection meets grounding standards. The antenna's grounding wire should be connected near the RouterBOARD outdoor case and can be joined with the same grounding wire used for the RouterBOARD.

## Shielded RJ45 Port vs Unshielded RJ45 Port

### Device with Shielded Ports

![shielded.png](/img/48f8692224741bf1.webp)
![](/img/530cf2c71e14e527.png)

### Device with Unshielded Ports

![unshielded.png](/img/7b2658fdb11cb76d.webp)

### PoE injector with shielded connectors

![poeinjector.png](/img/deaecaccb525b0c4.webp)

## RouterBOARD grounding wire attachment points

![](/img/c43fbb0b3ab9927f.webp)

![screw1.png](/img/01c1bd7ce52982e8.webp)

![screw2.png](/img/0d587a5baaa43769.webp)

:::info
You should not use Power Sourcing Equipment (PSE) with the positive terminal connected to Protective Earth (PE) if it power a MikroTik device. It may cause a short circuit, harm you and your device.

:::

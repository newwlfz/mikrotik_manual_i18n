---
sidebar_key: "internet-of-things/lora/user-guides/aws-lorawan-configuration"
sidebar_position: 1
title: "AWS LoRaWAN configuration"
sidebar_label: 'AWS LoRaWAN configuration'
description: 'This page guides users through configuring AWS LoRaWAN integration on MikroTik RouterOS, covering gateway registration in AWS IoT Core, certificate generation and importation, and server setup for LNS connectivity.'
tags:
  - 'aws'
  - 'iot'
  - 'lora'
source: https://manual.mikrotik.com/docs/internet-of-things/lora/user-guides/aws-lorawan-configuration
captured_at: '2026-11-09T11:35:47.715Z'
---

:::info
This scenario will work starting with RouterOS version **7.14beta8**.
:::

Before we proceed with the settings, you need to create an account in the AWS system. You can find more information on how to do that following this [link](https://aws.amazon.com/premiumsupport/knowledge-center/create-and-activate-aws-account/).

After you are logged-in, go to the **Services>IoT Core** section on the portal.

## AWS - Registering the gateway

The first step is to register the LoRaWAN gateway.

Navigate to the [Gateways](https://eu-central-1.console.aws.amazon.com/iot/home?region=eu-central-1#/wireless/gateways) section (under [LPWAN devices](https://eu-central-1.console.aws.amazon.com/iot/home?region=eu-central-1#/wireless/landing)).

![](/img/ed4ee05927b02491.webp)

Click on the "**Add gateway**" button.

### Step 1 - add gateway

- Input the gateway's EUI.
- Select device's frequency band.
- Configure optional fields if required.

![](/img/60a9686c5527b7cc.webp)

Finish the step by clicking on the "**Add gateway**" once again.

In RouterOS settings, gateway's EUI and frequency plan can be checked under the **IoT>LoRa>Devices** tab:

![](/img/680040c219bd18d6.webp)

### Step 2 - configure your gateway

- Generate a gateway certificate ("**Create certificate**" button), and download the certificate file and private key files ("**Download certificate files**" button).
- Copy CUPS and LNS endpoints and download server trust certificates ("**Download server trust certificates**" button).
- Add suggested gateway permissions.

![](/img/821bda4083751dfe.webp)

Finish the step by clicking on "**Submit**".

You will be redirected to the page where your newly created gateway should appear.

## RouterOS - Connecting the gateway

### Uploading and importing certificates

:::info
By default, **lora** service is trusted in the [certificate **trust-store**](/docs/authentication-authorization-accounting/certificates) and the build-in store already has required AWS Root certificate.
The steps below shows how to get and install Root AWS certificate if you wish to do it manually.

Skip importing AWS Root CA if **lora** service is enabled in the [certificate **trust-store**](/docs/authentication-authorization-accounting/certificates).
You still need to import unique device certificates.
:::

Before we proceed with the setup, you need to download [Amazon Root CA](https://www.amazontrust.com/repository/) and upload it, together with the gateway certificate file and its key, into the RouterOS file list menu:

![](/img/679d93cd6d29f923.webp)

After the files were uploaded, import the certificates, one by one (under **System>Certificates**):

![](/img/7dac383ebfcf0a67.webp)

Make sure to upload the gateway certificate first and then its key (so that the gateway certificate has both K-key and T-trusted flags present). In the end, you should have all 3 files imported, like so:

![](/img/2c8c5590f53d016a.webp)

### Server configuration

#### LNS scenario

Navigate to the **IoT>LoRa>Servers** tab and add a new server:

![](/img/582b6fdeddc052ca.webp)

- Name the server.
- Input the LNS endpoint address (without `wss://` and `:443`).
- Select the LNS protocol.
- Change port to "443".
- Enable SSL checkbox.
- Select the gateway certificate.

Make sure to apply the newly configured server under the **IoT>LoRa>Devices** tab:

![](/img/5104a0a5720db60f.webp)

And then, **enable** the LoRa interface.

#### CUPS scenario

Navigate to the **IoT>LoRa>Servers** tab and add a new server:

![](/img/771be9bf7ade270f.webp)

- Name the server.
- Input the CUPS endpoint address (without `https://` and `:443`).
- Select the CUPS protocol.
- Change the port to "443".
- Enable the SSL checkbox.
- Select the gateway certificate.

Make sure to apply the newly configured server under the **IoT>LoRa>Devices** tab:

![](/img/5104a0a5720db60f.webp)

And then, **enable** the LoRa interface.

### Connection verification

If everything is configured correctly, you should see a "connected" status on the AWS portal:

![](/img/d8cbfa6776b4b431.webp)

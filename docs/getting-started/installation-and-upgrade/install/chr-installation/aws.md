---
sidebar_key: "getting-started/installation-and-upgrade/install/chr-installation/aws"
sidebar_position: 1
title: "CHR: AWS Installation"
sidebar_label: 'CHR: AWS Installation'
description: 'Deploy MikroTik CHR on Amazon Web Services (AWS): launch it from the AWS Marketplace with a key pair, or import the raw disk image as an AMI and launch an EC2 instance from it.'
tags:
  - 'chr'
  - 'aws'
source: https://manual.mikrotik.com/docs/getting-started/installation-and-upgrade/install/chr-installation/aws
captured_at: '2026-11-28T10:14:44.799Z'
pagination_prev: "getting-started/installation-and-upgrade/install/chr-installation"
---

There are two ways to deploy CHR on Amazon Web Services (AWS):

- Launch it from the AWS Marketplace listing (see the end of this page). This is the quickest way.
- Import the raw disk image as an Amazon Machine Image (AMI) and launch an EC2 instance from it, as
  described in the following steps. Use this to run a RouterOS version of your choice.

## Prerequisites

- An AWS account with permissions to use EC2, S3, and the VM Import/Export service.
- The [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) installed and configured on your local machine.
- An S3 bucket to upload the CHR disk image.

:::info
The IAM user or role must have the `vmimport` service role configured. See the [AWS VM Import/Export documentation](https://docs.aws.amazon.com/vm-import/latest/userguide/vmimport-image-import.html) for required permissions and trust policies.
:::

## Step 1: Download the CHR raw disk image

1. Navigate to the [MikroTik download page](https://mikrotik.com/download).
2. Locate the latest Stable **CHR raw disk image** (`.img` file) for your target architecture.
3. Download and extract the archive (`chr-<version>.img.zip`).

## Step 2: Upload the image to S3

Upload the raw `.img` file to your S3 bucket:

```bash
aws s3 cp chr-x.x.x.img s3://YOUR-BUCKET-NAME/chr-x.x.x.img
```

Replace `YOUR-BUCKET-NAME` with your actual S3 bucket name, and `x.x.x` with the RouterOS version.

## Step 3: Create the import manifest

Create a JSON file (for example, `containers.json`) that describes the disk image for the import process:

```json
{
  "Description": "MikroTik RouterOS CHR",
  "Format": "raw",
  "UserBucket": {
    "S3Bucket": "YOUR-BUCKET-NAME",
    "S3Key": "chr-x.x.x.img"
  }
}
```

## Step 4: Import the snapshot

Start the snapshot import and capture the task ID:

```bash
aws ec2 import-snapshot \
  --description "MikroTik RouterOS CHR" \
  --disk-container file://containers.json
```

The output includes an `ImportTaskId`. Use it to monitor progress:

```bash
aws ec2 describe-import-snapshot-tasks \
  --import-task-ids import-snap-xxxxxxxxxxxxxxxxx
```

Wait until the status shows `completed`. The output will contain the `SnapshotId`.

## Step 5: Register the AMI

Register the imported snapshot as an AMI:

```bash
aws ec2 register-image \
  --name "MikroTik RouterOS CHR" \
  --description "MikroTik RouterOS CHR" \
  --architecture x86_64 \
  --virtualization-type hvm \
  --ena-support \
  --root-device-name "/dev/sda1" \
  --block-device-mappings "[{\"DeviceName\": \"/dev/sda1\", \"Ebs\": { \"SnapshotId\": \"snap-xxxxxxxxxxxxxxxxx\"}}]"
```

Replace the `SnapshotId` with the value from the previous step. The output includes an `ImageId` — this is your new AMI.

## Step 6: Launch an EC2 instance

1. Open the [EC2 console](https://console.aws.amazon.com/ec2/).
2. Navigate to **Images > AMIs** and locate your new CHR AMI.
3. Select it and choose **Launch**.
4. Choose an instance type (for example, `t3.micro` for testing).
5. Configure networking, security groups, and a key pair as needed.
6. Launch the instance.

:::warning
Ensure your security group allows SSH (port 22) and WinBox (port 8291) access from your management IP only. Secure the router immediately after first login — see [Securing your router](/docs/getting-started/securing-your-router).
:::

## Step 7: Connect to CHR

1. Connect via SSH using the instance's public IP:

   ```bash
   ssh admin@INSTANCE_PUBLIC_IP
   ```

2. On first login, review the software license and set a strong password.
3. Proceed with configuration. See [First time configuration](/docs/getting-started/first-time-configuration) for production setup guidance.

:::tip
AWS does not assign a public IP by default. Ensure your instance has a public IP or Elastic IP associated, and that the security group permits inbound SSH.
:::

## Alternative: Launch CHR from AWS Marketplace

You can deploy CHR directly from the AWS Marketplace without manually importing disk images.

1. Open the [MikroTik Cloud Hosted Router](https://aws.amazon.com/marketplace/pp/prodview-sf5gn6js6av54?sr=0-1&ref_=beagle&applicationId=AWSMPContessa) listing on AWS Marketplace.

   ![The Cloud Hosted Router listing on AWS Marketplace, sold by MikroTik, with the View purchase options button](/img/bd151a512b104c79.webp)

2. Select **View purchase options** and subscribe to **Cloud Hosted Router**.
3. In the EC2 console, create a key pair in the region where the router will run, and download it. You need this key pair to authenticate via SSH.

   ![The EC2 Key pairs page with no key pairs and the Create key pair button](/img/f61b41039019cb94.webp)
   ![The Create key pair form with the name CHR_key_pair, the type ED25519 and the .pem format](/img/a3104753cde203d1.webp)
   ![The key pair CHR_key_pair in the list after it was created](/img/30494a081ab804db.webp)

4. Select **Launch** on the listing. Choose the launch method, the region, the instance type, the VPC and the subnet. Create or select a [Security Group](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html); the default configuration provides reasonable security for the router. Select the key pair from step 3.

   ![The Launch Cloud Hosted Router form with One-click launch, the region, the instance type t3.nano, the VPC, the subnet, the security group CHR and the key pair CHR_key_pair](/img/8a12b75625afcb31.webp)

5. Select **Launch**. AWS starts the instance and shows a summary with its instance ID.

   ![The summary after the launch, with the instance ID, the AMI, the region, the instance type, the security group and the key pair](/img/ab4f67c9292629a5.webp)

## Connecting to the Marketplace instance

SSH access on port 22 is available immediately by using the downloaded key pair. The key is
installed as an SSH key of the `admin` user (`/user/ssh-keys/print`), and the license level is free:

```bash
ssh -i /path/to/keypair.pem admin@INSTANCE_PUBLIC_IP
```

![Connected to CHR](/img/12df9fdb0c36ffea.webp)

:::warning
On first login, set a strong password for the default user before enabling any additional access methods. Without a password, only SSH with the key pair is allowed. From there, you can enable HTTP, HTTPS, API, API-SSL, or WinBox access.
:::

# AWS Setup: S3 for Product Images

> **Status: waiting for the owner's approval. Nothing has been created in AWS.**
> Everything in Phase 7 works locally with S3Mock (no AWS account needed).
> Follow this guide only after approving it. Costs below are **estimates**:
> confirm them in the [AWS Pricing Calculator](https://calculator.aws/) before you start.

## 1. What we need, and why

| AWS service | What for | Created when |
|---|---|---|
| **AWS Budgets** | Email alerts before spending gets out of hand | **First**, before anything else |
| **S3** (one bucket in `ap-south-1`, Mumbai) | Stores product and category images, **private** | After the budget |
| **IAM** (one policy + one user for your PC) | Lets the backend use **only that bucket**, nothing else | With the bucket |
| *(later)* IAM **role** | Replaces the PC user's keys when the app is deployed | Phase 14 |
| *(later, optional)* CloudFront | Faster, cached image delivery | Phase 14, if needed |

No EC2, RDS, NAT gateways or load balancers. Those are the expensive ones, and none are needed now.

## 2. Estimated cost

Mumbai (`ap-south-1`) S3 Standard prices are roughly the following (**approximate; check the current price list**):

| Item | Approx. price | Our expected use | Approx. monthly cost |
|---|---|---|---|
| Storage | ~USD 0.025 per GB-month | 1,000 photos × ~300 KB ≈ 0.3 GB | **< USD 0.01** |
| Uploads (PUT) | ~USD 0.005 per 1,000 | a few hundred | **< USD 0.01** |
| Views (GET) | ~USD 0.0004 per 1,000 | 100,000 image views | **~USD 0.04** |
| Data transfer out | the first 100 GB/month to the internet is free across AWS | well under 100 GB | **USD 0** |

**Expected total at launch scale: well under USD 1 per month**, which your ~USD 100 credit
easily covers. It is not free, though, and the following can raise costs:
- huge files (we limit uploads to 5 MB);
- enabling versioning without a clean-up rule (old versions keep costing);
- leaving test files behind (delete test images);
- a public bucket abused by others (ours stays **private**).

Account eligibility: credits and free-tier rules depend on when and how the account was
opened. Check **Billing → Credits** and **Free Tier** in your console.

## 3. Step by step (AWS Console)

### Step 1: Budget alert (do this first)
1. Sign in as the account owner and open **Billing and Cost Management → Budgets → Create budget**.
2. Choose **Customize → Cost budget**, period **Monthly**, amount **USD 10**.
3. Add alerts at **50 %, 80 % and 100 %** of actual cost, sent to your email.
4. Also open **Billing preferences** and turn on **Free Tier usage alerts**.

### Step 2: Create the bucket
1. Open **S3 → Create bucket**. Region: **Asia Pacific (Mumbai) ap-south-1**.
2. Name: globally unique, lowercase, for example `leenax-swiftdrop-images-<random-word>`.
3. **Object Ownership:** *ACLs disabled (Bucket owner enforced)*.
4. **Block all public access: ON** (all four boxes). This keeps the bucket private.
5. **Versioning:** off for now.
6. **Default encryption:** SSE-S3 (the default).
7. Create.

### Step 3: Least-privilege permissions (IAM policy)
**IAM → Policies → Create policy → JSON**, replacing `YOUR-BUCKET`:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SwiftDropImagesOnly",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": [
        "arn:aws:s3:::YOUR-BUCKET/products/*",
        "arn:aws:s3:::YOUR-BUCKET/categories/*"
      ]
    }
  ]
}
```
Name it `SwiftDropImagesAccess`. It can't list, delete the bucket, or touch anything else.

### Step 4: Credentials for your PC (development only)
1. **IAM → Users → Create user** `swiftdrop-local-dev` (no console access) and attach **only** `SwiftDropImagesAccess`.
2. Open the user → **Security credentials → Create access key → Local code**.
3. On your PC, install the AWS CLI and run:
   ```powershell
   aws configure --profile swiftdrop
   ```
   Paste the key and secret when asked; region `ap-south-1`. They are saved in
   `C:\Users\hp\.aws\credentials`, **outside the project, never in Git or `.env`**.
4. Never share the secret, never paste it in chats, and delete this key once the app runs
   on AWS with an IAM role (Phase 14).

### Step 5: Point the backend at AWS
In the root `.env`:
```
# S3_ENDPOINT=http://localhost:9090      ← comment out or delete this line
S3_BUCKET=leenax-swiftdrop-images-<random-word>
AWS_REGION=ap-south-1
AWS_PROFILE_NAME=swiftdrop
```
Restart the backend, upload a photo in the admin, and check it in the store.

### Step 6: Verify the bucket is private
Copy an image link from the store, delete everything from `?` onwards, and open it.
You must see **AccessDenied**. With the full link (including the signature) it works for one hour.

## 4. Rolling back
- Switch back to local: restore `S3_ENDPOINT=http://localhost:9090` in `.env`.
- Remove AWS resources: empty and delete the bucket, delete the IAM user (and its access key) and the policy. The budget can stay (it's free).

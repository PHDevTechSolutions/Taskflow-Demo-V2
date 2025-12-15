import type { NextApiRequest, NextApiResponse } from "next";

const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN; // e.g. "es-home-ph.myshopify.com"
const SHOPIFY_PRODUCT_TOKEN_SUBMISSION = process.env.SHOPIFY_PRODUCT_TOKEN_SUBMISSION;

interface ManualProductPayload {
  title: string;
  sku: string;
  description: string;
  quantity: number;
  price: string;
  imageAttachment?: string; // base64 string without prefix
  imageFilename?: string;
}

// Helper to upload file to Shopify Files API (optional, not used in current flow)
async function uploadFileToShopify(
  fileBuffer: Buffer,
  filename: string,
  token: string,
  storeDomain: string
) {
  const url = `https://${storeDomain}/admin/api/2023-10/files.json`;

  const base64File = fileBuffer.toString("base64");

  const payload = {
    file: {
      attachment: base64File,
      filename: filename,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to upload file to Shopify: ${errorText}`);
  }

  const data = await res.json();
  return data.file.public_url;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const {
    title,
    sku,
    description,
    quantity,
    price,
    imageAttachment,
    imageFilename,
  }: ManualProductPayload = req.body;

  if (!title || !sku || quantity === undefined || price === undefined) {
    return res
      .status(400)
      .json({ message: "Missing required fields: title, sku, quantity, price" });
  }

  if (!SHOPIFY_STORE_DOMAIN || !SHOPIFY_PRODUCT_TOKEN_SUBMISSION) {
    return res
      .status(500)
      .json({ message: "Shopify environment variables missing" });
  }

  try {
    // Step 1: Create product without image
    const productData = {
      product: {
        title,
        body_html: description || "",
        variants: [
          {
            sku,
            price,
            inventory_quantity: quantity,
            inventory_management: "shopify",
          },
        ],
        status: "draft",
      },
    };

    const createProductRes = await fetch(
      `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2023-10/products.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": SHOPIFY_PRODUCT_TOKEN_SUBMISSION,
        },
        body: JSON.stringify(productData),
      }
    );

    if (!createProductRes.ok) {
      const errorText = await createProductRes.text();
      return res.status(createProductRes.status).json({
        message: "Failed to create product on Shopify",
        details: errorText,
      });
    }

    const createProductData = await createProductRes.json();
    const productId = createProductData.product.id;

    // Step 2: Upload image if provided
    if (imageAttachment) {
      const imagePayload = {
        image: {
          attachment: imageAttachment, // base64 encoded image string WITHOUT data:image/... prefix
          filename: imageFilename || "product-image.jpg",
        },
      };

      const uploadImageRes = await fetch(
        `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2023-10/products/${productId}/images.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": SHOPIFY_PRODUCT_TOKEN_SUBMISSION,
          },
          body: JSON.stringify(imagePayload),
        }
      );

      if (!uploadImageRes.ok) {
        const errorText = await uploadImageRes.text();
        return res.status(uploadImageRes.status).json({
          message: "Failed to upload product image",
          details: errorText,
        });
      }
    }

    return res.status(201).json({
      message: "Product created successfully",
      productId,
    });
  } catch (error: any) {
    console.error("Shopify product creation error:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message || error.toString(),
    });
  }
}

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import {
  bynToMinor,
  MAX_VARIANTS_PER_PRODUCT,
  MAX_IMAGE_BYTES,
  type AdminProductDto,
} from '@vapehard/shared';
import { ImagePlus, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useBlocker, useNavigate, useParams, type LoaderFunctionArgs } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';

import { NotFoundError } from '../../shared/lib/api';
import { prefetch } from '../../shared/lib/query-client';
import { Button } from '../../shared/ui/button';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog';
import { categoriesQuery } from '../catalog/api';

import {
  adminProductQuery,
  uploadToPresignedPost,
  useCreateProduct,
  usePresign,
  useReplaceVariants,
  useUpdateProduct,
} from './api';

function productIdFrom(params: LoaderFunctionArgs['params']): number | null {
  if (!params.id) return null;
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) throw new NotFoundError();
  return id;
}

export async function loader({ params }: LoaderFunctionArgs) {
  const id = productIdFrom(params);
  await Promise.all([prefetch(categoriesQuery()), id ? prefetch(adminProductQuery(id)) : null]);
  return null;
}

/** Prices are typed in BYN ("28" or "28,50") and converted to kopecks on submit. */
const priceField = z
  .string()
  .trim()
  .regex(/^\d{1,6}([.,]\d{1,2})?$/, 'Введите цену, например 28 или 28,50');

const formSchema = z
  .object({
    name: z.string().trim().min(2, 'Минимум 2 символа').max(150),
    description: z.string().trim().max(2000),
    categoryId: z.coerce.number<string>().int().positive('Выберите категорию'),
    price: priceField,
    oldPrice: priceField.or(z.literal('')),
    variants: z
      .array(
        z.object({
          id: z.number().optional(),
          name: z.string().trim().min(1, 'Введите название'),
          stock: z.coerce.number<string | number>().int().min(0, 'Не меньше 0'),
        }),
      )
      .min(1, 'Нужен хотя бы один вариант')
      .max(MAX_VARIANTS_PER_PRODUCT, `Максимум ${String(MAX_VARIANTS_PER_PRODUCT)} вариантов`)
      .superRefine((list, ctx) => {
        const seen = new Set<string>();
        list.forEach((v, i) => {
          const key = v.name.trim().toLowerCase();
          if (key && seen.has(key))
            ctx.addIssue({ code: 'custom', message: 'Такой вариант уже есть', path: [i, 'name'] });
          seen.add(key);
        });
      }),
  })
  .refine((v) => !v.oldPrice || toMinor(v.oldPrice) > toMinor(v.price), {
    message: 'Старая цена должна быть больше цены',
    path: ['oldPrice'],
  });

type FormInput = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

function toMinor(byn: string): number {
  return bynToMinor(Number(byn.replace(',', '.')));
}
const toByn = (minor: number) => (minor / 100).toString().replace('.', ',');

function defaults(product: AdminProductDto | undefined): FormInput {
  return product
    ? {
        name: product.name,
        description: product.description,
        categoryId: String(product.categoryId),
        price: toByn(product.priceMinor),
        oldPrice: product.oldPriceMinor === null ? '' : toByn(product.oldPriceMinor),
        variants: product.variants.map((v) => ({ id: v.id, name: v.name, stock: v.stock })),
      }
    : {
        name: '',
        description: '',
        categoryId: '',
        price: '',
        oldPrice: '',
        variants: [{ name: 'Основной вариант', stock: 10 }],
      };
}

function ImageUpload({
  value,
  previewUrl,
  onChange,
}: {
  value: string | null;
  previewUrl: string | null;
  onChange: (key: string, preview: string) => void;
}) {
  const presign = usePresign();
  const [progress, setProgress] = useState<number | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/'))
      return void toast.error('Можно загрузить только изображение');
    if (file.size > MAX_IMAGE_BYTES) return void toast.error('Максимальный размер — 5 МБ');
    try {
      const { url, fields, key } = await presign.mutateAsync(file);
      setProgress(0);
      await uploadToPresignedPost(url, fields, file, setProgress);
      onChange(key, URL.createObjectURL(file));
    } catch {
      toast.error('Не удалось загрузить изображение');
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        {previewUrl ? (
          <img src={previewUrl} alt="Превью" className="size-full object-cover" />
        ) : (
          <ImagePlus className="size-6 text-slate-500" aria-hidden />
        )}
      </div>
      <div className="flex-1 space-y-1">
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-xl bg-slate-800 px-4 text-sm font-bold text-slate-100 hover:bg-slate-700 focus-within:ring-2 focus-within:ring-vape-glow">
          {value ? 'Заменить фото' : 'Загрузить фото'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
            className="sr-only"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </label>
        {progress !== null && (
          <div
            className="h-2 w-full overflow-hidden rounded bg-slate-800"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Загрузка изображения"
          >
            <div
              className="h-full bg-vape-accent transition-all"
              style={{ width: `${String(progress)}%` }}
            />
          </div>
        )}
        <p className="text-xs text-vape-muted">PNG, JPEG, WebP · до 5 МБ</p>
      </div>
    </div>
  );
}

const inputClass =
  'min-h-11 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 text-sm text-white focus:border-vape-accent focus:outline-none aria-invalid:border-vape-red';

function FieldError({ id, message }: { id: string; message: string | undefined }) {
  return message ? (
    <p id={id} className="mt-1 text-xs text-red-400">
      {message}
    </p>
  ) : null;
}

export function Component() {
  const productId = productIdFrom(useParams());
  const { data: categories } = useSuspenseQuery(categoriesQuery());
  const { data: product } = useQuery({
    ...adminProductQuery(productId ?? 0),
    enabled: productId !== null,
  });
  const navigate = useNavigate();
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const replaceVariants = useReplaceVariants();

  const [imageKey, setImageKey] = useState<string | null>(product?.imageKey ?? null);
  const [preview, setPreview] = useState<string | null>(product?.imageUrl ?? null);
  const [saved, setSaved] = useState(false);

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: defaults(product),
    shouldFocusError: true,
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'variants' });
  const errors = form.formState.errors;
  const dirty = (form.formState.isDirty || imageKey !== (product?.imageKey ?? null)) && !saved;

  // Unsaved-changes warning for in-app navigation and for closing the tab.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [dirty]);

  const onSubmit = form.handleSubmit(async (values) => {
    const base = {
      name: values.name,
      description: values.description,
      categoryId: values.categoryId,
      priceMinor: toMinor(values.price),
      oldPriceMinor: values.oldPrice ? toMinor(values.oldPrice) : null,
      imageKey,
    };
    const variants = values.variants.map((v) => ({
      ...(v.id ? { id: v.id } : {}),
      name: v.name,
      stock: v.stock,
    }));
    if (productId) {
      await update.mutateAsync({ id: productId, input: base });
      await replaceVariants.mutateAsync({ productId, variants });
    } else {
      await create.mutateAsync({ ...base, variants });
    }
    setSaved(true);
    toast.success(productId ? 'Товар сохранён' : 'Товар добавлен');
    void navigate('/admin/stock');
  });

  const pending = create.isPending || update.isPending || replaceVariants.isPending;

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      noValidate
      className="space-y-3 rounded-2xl border border-slate-800 bg-vape-card p-4"
    >
      <h2 className="text-base font-bold text-white">
        {productId ? 'Редактирование товара' : 'Новый товар'}
      </h2>

      <div>
        <label htmlFor="name" className="mb-1 block text-sm text-slate-300">
          Название товара
        </label>
        <input
          id="name"
          className={inputClass}
          placeholder="Напр. Vaporesso Luxe Q2"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby="name-error"
          {...form.register('name')}
        />
        <FieldError id="name-error" message={errors.name?.message} />
      </div>

      <div>
        <label htmlFor="description" className="mb-1 block text-sm text-slate-300">
          Описание
        </label>
        <textarea
          id="description"
          rows={3}
          className={`${inputClass} py-2`}
          {...form.register('description')}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="categoryId" className="mb-1 block text-sm text-slate-300">
            Категория
          </label>
          <select
            id="categoryId"
            className={inputClass}
            aria-invalid={errors.categoryId ? true : undefined}
            aria-describedby="category-error"
            {...form.register('categoryId')}
          >
            <option value="">Выберите</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <FieldError id="category-error" message={errors.categoryId?.message} />
        </div>
        <div>
          <label htmlFor="price" className="mb-1 block text-sm text-slate-300">
            Цена, BYN
          </label>
          <input
            id="price"
            inputMode="decimal"
            className={inputClass}
            placeholder="28"
            aria-invalid={errors.price ? true : undefined}
            aria-describedby="price-error"
            {...form.register('price')}
          />
          <FieldError id="price-error" message={errors.price?.message} />
        </div>
      </div>

      <div>
        <label htmlFor="oldPrice" className="mb-1 block text-sm text-slate-300">
          Старая цена (для уценки), BYN
        </label>
        <input
          id="oldPrice"
          inputMode="decimal"
          className={inputClass}
          placeholder="Необязательно"
          aria-invalid={errors.oldPrice ? true : undefined}
          aria-describedby="old-price-error"
          {...form.register('oldPrice')}
        />
        <FieldError id="old-price-error" message={errors.oldPrice?.message} />
      </div>

      <ImageUpload
        value={imageKey}
        previewUrl={preview}
        onChange={(key, url) => {
          setImageKey(key);
          setPreview(url);
        }}
      />

      <fieldset className="space-y-2 border-t border-slate-800 pt-3">
        <div className="flex items-center justify-between">
          <legend className="text-sm font-bold text-slate-200">
            Вкусы / варианты ({fields.length}/{MAX_VARIANTS_PER_PRODUCT})
          </legend>
          <Button
            variant="secondary"
            disabled={fields.length >= MAX_VARIANTS_PER_PRODUCT}
            onClick={() => {
              append({ name: '', stock: 10 });
            }}
            icon={<Plus className="size-4" aria-hidden />}
          >
            Добавить
          </Button>
        </div>
        <FieldError
          id="variants-error"
          message={errors.variants?.message ?? errors.variants?.root?.message}
        />
        <ul className="space-y-2">
          {fields.map((field, i) => (
            <li key={field.id} className="flex items-start gap-1.5">
              <div className="flex-1">
                <input
                  aria-label={`Вариант ${String(i + 1)}: название`}
                  placeholder={`Вкус #${String(i + 1)}`}
                  className={inputClass}
                  aria-invalid={errors.variants?.[i]?.name ? true : undefined}
                  {...form.register(`variants.${i}.name`)}
                />
                <FieldError
                  id={`variant-${String(i)}-error`}
                  message={errors.variants?.[i]?.name?.message}
                />
              </div>
              <input
                aria-label={`Вариант ${String(i + 1)}: остаток`}
                type="number"
                min={0}
                className={`${inputClass} w-20 text-center font-bold`}
                {...form.register(`variants.${i}.stock`)}
              />
              <button
                type="button"
                aria-label={`Удалить вариант ${String(i + 1)}`}
                disabled={fields.length <= 1}
                onClick={() => {
                  remove(i);
                }}
                className="flex size-11 items-center justify-center text-red-400 disabled:opacity-30"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </fieldset>

      <Button type="submit" block pending={pending}>
        Сохранить товар
      </Button>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.();
        }}
        title="Уйти без сохранения?"
        description="Изменения в товаре будут потеряны."
        confirmText="Уйти"
        onConfirm={() => {
          blocker.proceed?.();
        }}
      />
    </form>
  );
}

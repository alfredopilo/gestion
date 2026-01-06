import React from 'react';

/**
 * Componente de campo de formulario moderno con iconos, validación y estilos mejorados
 * 
 * @param {Object} props - Propiedades del componente
 * @param {string} props.label - Etiqueta del campo
 * @param {string} props.name - Nombre del campo
 * @param {string} props.type - Tipo de input (text, email, password, number, date, etc.)
 * @param {React.ReactNode} props.icon - Icono a mostrar en el campo
 * @param {string} props.error - Mensaje de error
 * @param {boolean} props.required - Si el campo es requerido
 * @param {string} props.placeholder - Placeholder del campo
 * @param {string} props.helpText - Texto de ayuda
 * @param {boolean} props.disabled - Si el campo está deshabilitado
 * @param {string} props.value - Valor del campo
 * @param {Function} props.onChange - Función onChange
 * @param {Object} props - Resto de props del input
 */
const FormField = ({ 
  label, 
  name, 
  type = "text", 
  icon, 
  error, 
  required = false,
  placeholder,
  helpText,
  disabled = false,
  value,
  onChange,
  ...props 
}) => {
  return (
    <div className="mb-4">
      {/* Label */}
      {label && (
        <label 
          htmlFor={name}
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          {label} 
          {required && <span className="text-danger-500 ml-1">*</span>}
        </label>
      )}
      
      {/* Input container */}
      <div className="relative">
        {/* Icon */}
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            {icon}
          </div>
        )}
        
        {/* Input */}
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={`
            ${error ? 'input-field-error' : 'input-field'} 
            ${icon ? 'pl-10' : ''}
            ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}
          `}
          {...props}
        />
        
        {/* Error icon */}
        {error && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-danger-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>
      
      {/* Error message */}
      {error && (
        <p className="mt-1.5 text-sm text-danger-600 flex items-center animate-slide-up">
          <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
      
      {/* Help text */}
      {helpText && !error && (
        <p className="mt-1.5 text-sm text-gray-500">
          {helpText}
        </p>
      )}
    </div>
  );
};

/**
 * Componente de área de texto moderno con validación
 */
export const TextAreaField = ({ 
  label, 
  name, 
  icon, 
  error, 
  required = false,
  placeholder,
  helpText,
  disabled = false,
  value,
  onChange,
  rows = 4,
  ...props 
}) => {
  return (
    <div className="mb-4">
      {/* Label */}
      {label && (
        <label 
          htmlFor={name}
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          {label} 
          {required && <span className="text-danger-500 ml-1">*</span>}
        </label>
      )}
      
      {/* Textarea */}
      <div className="relative">
        <textarea
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          rows={rows}
          className={`
            ${error ? 'input-field-error' : 'input-field'} 
            ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}
            resize-none
          `}
          {...props}
        />
        
        {/* Error icon */}
        {error && (
          <div className="absolute top-3 right-3 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-danger-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>
      
      {/* Error message */}
      {error && (
        <p className="mt-1.5 text-sm text-danger-600 flex items-center animate-slide-up">
          <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
      
      {/* Help text */}
      {helpText && !error && (
        <p className="mt-1.5 text-sm text-gray-500">
          {helpText}
        </p>
      )}
    </div>
  );
};

/**
 * Componente de select moderno con validación
 */
export const SelectField = ({ 
  label, 
  name, 
  icon, 
  error, 
  required = false,
  helpText,
  disabled = false,
  value,
  onChange,
  options = [],
  placeholder = "Seleccione una opción",
  ...props 
}) => {
  return (
    <div className="mb-4">
      {/* Label */}
      {label && (
        <label 
          htmlFor={name}
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          {label} 
          {required && <span className="text-danger-500 ml-1">*</span>}
        </label>
      )}
      
      {/* Select container */}
      <div className="relative">
        {/* Icon */}
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            {icon}
          </div>
        )}
        
        {/* Select */}
        <select
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
          className={`
            ${error ? 'input-field-error' : 'input-field'} 
            ${icon ? 'pl-10' : ''}
            ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}
            appearance-none
          `}
          {...props}
        >
          {placeholder && (
            <option value="">{placeholder}</option>
          )}
          {options.map((option, index) => (
            <option key={index} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        
        {/* Dropdown arrow */}
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      
      {/* Error message */}
      {error && (
        <p className="mt-1.5 text-sm text-danger-600 flex items-center animate-slide-up">
          <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
      
      {/* Help text */}
      {helpText && !error && (
        <p className="mt-1.5 text-sm text-gray-500">
          {helpText}
        </p>
      )}
    </div>
  );
};

export default FormField;
